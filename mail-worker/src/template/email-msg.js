import emailUtils from '../utils/email-utils';
import dayjs from 'dayjs';

function escapeHtml(text = '') {
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function cleanPreview(rawText, maxLen = 1500) {
	if (!rawText) return '';
	let text = rawText.trim();
	// Collapse excessive historical reply chains
	const replyMarker = text.search(/(\r?\n|^)(>{1,}\s*|On\s+.+wrote:|-----Original Message-----|------------------ 原始邮件 ------------------|发件人:\s*)/i);
	if (replyMarker > 0) {
		text = text.slice(0, replyMarker).trim() + '\n\n[Quoted text hidden]';
	}
	if (text.length > maxLen) {
		text = text.slice(0, maxLen).trim() + '...';
	}
	return escapeHtml(text);
}

export default function emailMsgTemplate(email, tgMsgTo, tgMsgFrom, tgMsgText) {
	const subject = escapeHtml(email.subject || '(无主题)');

	// Sender format: Name <email@example.com>
	let fromStr = '';
	const senderEmail = email.sendEmail || '';
	const senderName = email.name || '';
	if (senderName && senderEmail && senderName !== senderEmail) {
		fromStr = `${escapeHtml(senderName)} &lt;${escapeHtml(senderEmail)}&gt;`;
	} else {
		fromStr = escapeHtml(senderEmail || senderName || 'Unknown');
	}

	const toStr = escapeHtml(email.toEmail || '');

	// Time formatting: e.g. "Oct 2 · 22:20"
	const timeStr = dayjs(email.createTime || new Date()).format('MMM D · HH:mm');

	let template = `📬 <b>New Mail</b>

<b>${subject}</b>

👤 <b>From</b>
${fromStr}

📥 <b>To</b>
${toStr}

🕒 <b>Time</b>
${timeStr}`;

	if (tgMsgText !== 'hide') {
		const rawBody = emailUtils.formatText(email.text) || emailUtils.htmlToText(email.content) || '';
		const preview = cleanPreview(rawBody, 1500);
		if (preview) {
			template += `\n\n<blockquote expandable>\n${preview}\n</blockquote>`;
		}
	}

	return template;
}

