import app from '../hono/hono';
import telegramService from '../service/telegram-service';
import result from '../model/result';
import BizError from '../error/biz-error';
import jwtUtils from '../utils/jwt-utils';
import { t } from '../i18n/i18n';

app.get('/telegram/getEmail/:token', async (c) => {
	const content = await telegramService.getEmailContent(c, c.req.param());
	c.header('Cache-Control', 'public, max-age=604800, immutable');
	return c.html(content);
});

app.post('/telegram/webhook', async (c) => {
	return await telegramService.handleWebhook(c);
});

const checkTelegramAdmin = async (c) => {
	const raw = c.req.header('token') || c.req.header('Authorization') || c.req.query('key') || c.req.query('secret') || '';
	const token = raw.replace(/^Bearer\s+/i, '').trim();
	const isSecretValid = token && (token === c.env.jwt_secret);
	const isJwtValid = token && (await jwtUtils.verifyToken(c, token));
	if (!isSecretValid && !isJwtValid) {
		throw new BizError(t('unauthorized'), 401);
	}
};

app.all('/telegram/setupWebhook', async (c) => {
	await checkTelegramAdmin(c);
	const data = await telegramService.setupWebhook(c);
	return c.json(result.ok(data));
});

app.all('/telegram/setWebhook', async (c) => {
	await checkTelegramAdmin(c);
	const data = await telegramService.setupWebhook(c);
	return c.json(result.ok(data));
});

app.all('/telegram/webhookInfo', async (c) => {
	await checkTelegramAdmin(c);
	const data = await telegramService.getWebhookInfo(c);
	return c.json(result.ok(data));
});



