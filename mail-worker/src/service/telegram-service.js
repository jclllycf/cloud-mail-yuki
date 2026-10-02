import orm from '../entity/orm';
import email from '../entity/email';
import settingService from './setting-service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
import { eq } from 'drizzle-orm';
import jwtUtils from '../utils/jwt-utils';
import emailMsgTemplate from '../template/email-msg';
import emailTextTemplate from '../template/email-text';
import emailHtmlTemplate from '../template/email-html';
import verifyUtils from '../utils/verify-utils';
import domainUtils from "../utils/domain-uitls";

const telegramService = {

	async getEmailContent(c, params) {

		const { token } = params

		const result = await jwtUtils.verifyToken(c, token);

		if (!result) {
			return emailTextTemplate('Access denied')
		}

		const emailRow = await orm(c).select().from(email).where(eq(email.emailId, result.emailId)).get();

		if (emailRow) {

			if (emailRow.content) {
				const { r2Domain } = await settingService.query(c);
				return emailHtmlTemplate(emailRow.content || '', r2Domain)
			} else {
				return emailTextTemplate(emailRow.text || '')
			}

		} else {
			return emailTextTemplate('The email does not exist')
		}

	},

	async sendEmailToBot(c, email) {

		const { tgBotToken, tgChatId, customDomain, tgMsgTo, tgMsgFrom, tgMsgText } = await settingService.query(c);

		const tgChatIds = tgChatId.split(',');

		const jwtToken = await jwtUtils.generateToken(c, { emailId: email.emailId })

		const baseDomain = customDomain ? domainUtils.toOssDomain(customDomain) : 'https://mail.jcllyuki.com';
		const webAppUrl = `${baseDomain}/api/telegram/getEmail/${jwtToken}`;
		const mailWebUrl = `${baseDomain}/mail?id=${email.emailId}`;

		const inlineKeyboard = [];

		if (email.code) {
			inlineKeyboard.push([
				{
					text: `📋 Copy ${email.code}`,
					copy_text: { text: email.code }
				}
			]);
		}

		inlineKeyboard.push([
			{
				text: '⚡ Quick View',
				web_app: { url: webAppUrl }
			},
			{
				text: '📬 Open in YUKI MAIL',
				url: mailWebUrl
			}
		]);

		await Promise.all(tgChatIds.map(async chatId => {
			try {
				const res = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						chat_id: chatId,
						parse_mode: 'HTML',
						text: emailMsgTemplate(email, tgMsgTo, tgMsgFrom, tgMsgText),
						reply_markup: {
							inline_keyboard: inlineKeyboard
						}
					})
				});
				if (!res.ok) {
					console.error(`转发 Telegram 失败 status: ${res.status} response: ${await res.text()}`);
				}
			} catch (e) {
				console.error(`转发 Telegram 失败:`, e.message);
			}
		}));

	},

	async getWebhookSecret(c, tgBotToken) {
		if (!tgBotToken) return '';
		const raw = `${tgBotToken}:${c.env?.jwt_secret || 'cloud-mail-telegram'}`;
		const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
		return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
	},

	async handleWebhook(c) {
		const { tgBotToken } = await settingService.query(c);
		if (!tgBotToken) {
			return c.text('Bot not configured', 200);
		}

		const headerSecret = c.req.header('X-Telegram-Bot-Api-Secret-Token');
		const expectedSecret = await this.getWebhookSecret(c, tgBotToken);
		if (headerSecret !== expectedSecret) {
			return c.text('Unauthorized', 401);
		}

		const update = await c.req.json().catch(() => null);
		if (!update || !update.message || !update.message.text) {
			return c.text('OK');
		}

		const message = update.message;
		const text = (message.text || '').trim();
		const chatId = message.chat?.id;
		if (!chatId) return c.text('OK');

		if (text === '/start' || text.startsWith('/start ') || text.startsWith('/start@')) {
			const reply = `📬 <b>YUKI MAIL BOT</b>\n\nConnected successfully.\n\nI’ll notify you here when new mail arrives at jcllyuki.com.\n\n• Mail: mail.jcllyuki.com\n• Storage: R2\n• Notifications: Enabled`;
			await this.sendTelegramMsg(tgBotToken, chatId, reply);
			return c.text('OK');
		}

		if (text === '/help' || text.startsWith('/help ') || text.startsWith('/help@')) {
			const reply = `📬 <b>YUKI MAIL BOT</b>\n\nPersonal mail notification service.\n\n📩 New mail notifications\n🔐 Verification code extraction\n👁 Mail preview`;
			await this.sendTelegramMsg(tgBotToken, chatId, reply);
			return c.text('OK');
		}

		// Silently ignore other commands or messages
		return c.text('OK');
	},

	async sendTelegramMsg(tgBotToken, chatId, htmlText) {
		try {
			await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					chat_id: chatId,
					parse_mode: 'HTML',
					text: htmlText
				})
			});
		} catch (e) {
			console.error('发送 Telegram 消息失败:', e.message);
		}
	},

	async setupWebhook(c) {
		const { tgBotToken, customDomain } = await settingService.query(c);
		if (!tgBotToken) {
			return { success: false, error: 'Telegram Bot Token is not configured' };
		}
		const domain = domainUtils.toOssDomain(customDomain);
		if (!domain) {
			return { success: false, error: 'Worker custom domain is not configured' };
		}
		const webhookUrl = `${domain}/api/telegram/webhook`;
		const secretToken = await this.getWebhookSecret(c, tgBotToken);

		const res = await fetch(`https://api.telegram.org/bot${tgBotToken}/setWebhook`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				url: webhookUrl,
				secret_token: secretToken,
				allowed_updates: ['message']
			})
		});
		const data = await res.json();
		const info = await this.getWebhookInfo(c);
		return { setWebhook: data, webhookInfo: info, webhookUrl };
	},

	async getWebhookInfo(c) {
		const { tgBotToken } = await settingService.query(c);
		if (!tgBotToken) return { error: 'Telegram Bot Token not configured' };
		const res = await fetch(`https://api.telegram.org/bot${tgBotToken}/getWebhookInfo`);
		return await res.json();
	}

}

export default telegramService;

