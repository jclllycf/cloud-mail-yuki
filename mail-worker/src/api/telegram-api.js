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

app.all('/telegram/setupWebhook', async (c) => {
	const authHeader = c.req.header('token') || c.req.query('key');
	const isSecretValid = authHeader && (authHeader === c.env.jwt_secret);
	const isJwtValid = authHeader && (await jwtUtils.verifyToken(c, authHeader));
	if (!isSecretValid && !isJwtValid) {
		throw new BizError(t('unauthorized'), 401);
	}
	const data = await telegramService.setupWebhook(c);
	return c.json(result.ok(data));
});

app.all('/telegram/webhookInfo', async (c) => {
	const authHeader = c.req.header('token') || c.req.query('key');
	const isSecretValid = authHeader && (authHeader === c.env.jwt_secret);
	const isJwtValid = authHeader && (await jwtUtils.verifyToken(c, authHeader));
	if (!isSecretValid && !isJwtValid) {
		throw new BizError(t('unauthorized'), 401);
	}
	const data = await telegramService.getWebhookInfo(c);
	return c.json(result.ok(data));
});


