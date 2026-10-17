import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';
import emailService from './service/email-service';
import kvObjService from './service/kv-obj-service';
import oauthService from './service/oauth-service';
import analysisService from './service/analysis-service';

// Keep search engines from indexing the webmail app, its APIs and private resources.
function noIndex(response) {
	const headers = new Headers(response.headers);
	headers.set('X-Robots-Tag', 'noindex');
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
	 async fetch(req, env, ctx) {

		const url = new URL(req.url)

		// An empty sitemap must not be served as the SPA's index.html.
		if (url.pathname === '/sitemap.xml') {
			return new Response('Not Found', {
				status: 404,
				headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' }
			});
		}

		// Serve the actual public/robots.txt asset as text, not the HTML fallback.
		if (url.pathname === '/robots.txt') {
			return env.assets.fetch(req);
		}

		if (url.pathname.startsWith('/api/')) {
			url.pathname = url.pathname.replace('/api', '')
			req = new Request(url.toString(), req)
			return noIndex(await app.fetch(req, env, ctx));
		}

		if (url.pathname.startsWith('/telegram/')) {
			return noIndex(await app.fetch(req, env, ctx));
		}

		 if (['/static/','/attachments/'].some(p => url.pathname.startsWith(p))) {
			 return noIndex(await kvObjService.toObjResp({ env }, url.pathname.substring(1)));
		 }

		return noIndex(await env.assets.fetch(req));
	},
	email: email,
	async scheduled(c, env, ctx) {
		if (c.cron === '*/30 * * * *') {
			await analysisService.refreshEchartsCache({ env })
			return;
		}

		await verifyRecordService.clearRecord({ env })
		await userService.resetDaySendCount({ env })
		await emailService.completeReceiveAll({ env })
		await emailService.autoClean({ env })
		await analysisService.refreshEchartsCache({ env })
		await oauthService.clearNoBindOathUser({ env })
	},
};
