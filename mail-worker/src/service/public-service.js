import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { v4 as uuidv4 } from 'uuid';
import { and, asc, desc, eq, sql, or, gte, lte } from 'drizzle-orm';
import saltHashUtils from '../utils/crypto-utils';
import cryptoUtils from '../utils/crypto-utils';
import emailUtils from '../utils/email-utils';
import roleService from './role-service';
import verifyUtils from '../utils/verify-utils';
import { t } from '../i18n/i18n';
import reqUtils from '../utils/req-utils';
import dayjs from 'dayjs';
import { isDel, roleConst } from '../const/entity-const';
import email from '../entity/email';
import { att } from '../entity/att';
import userService from './user-service';
import emailService from './email-service';
import accountService from './account-service';
import settingService from './setting-service';
import KvConst from '../const/kv-const';

const publicService = {

	async emailList(c, params) {

		let { toEmail, content, subject, sendName, sendEmail, timeSort, num, size, type, isDel, compact, emailId, query: searchQuery, since, before } = params;

		if (!size) {
			size = 20;
		}

		if (!num) {
			num = 1;
		}

		size = Number(size);
		num = Number(num);
		num = (num - 1) * size;

		const isCompact = compact === true || compact === 'true' || compact === 1 || compact === '1';

		const selectFields = isCompact ? {
			emailId: email.emailId,
			sendEmail: email.sendEmail,
			sendName: email.name,
			toEmail: email.toEmail,
			toName: email.toName,
			subject: email.subject,
			createTime: email.createTime,
			type: email.type,
			isDel: email.isDel,
			unread: email.unread,
			code: email.code,
			hasAttachment: sql`CASE WHEN (SELECT 1 FROM attachments WHERE attachments.email_id = ${email.emailId} LIMIT 1) IS NOT NULL THEN 1 ELSE 0 END`.as('has_attachment'),
			attCount: sql`(SELECT COUNT(*) FROM attachments WHERE attachments.email_id = ${email.emailId})`.as('att_count')
		} : {
			emailId: email.emailId,
			sendEmail: email.sendEmail,
			sendName: email.name,
			subject: email.subject,
			toEmail: email.toEmail,
			toName: email.toName,
			type: email.type,
			createTime: email.createTime,
			content: email.content,
			text: email.text,
			isDel: email.isDel,
			unread: email.unread,
			code: email.code,
			hasAttachment: sql`CASE WHEN (SELECT 1 FROM attachments WHERE attachments.email_id = ${email.emailId} LIMIT 1) IS NOT NULL THEN 1 ELSE 0 END`.as('has_attachment'),
			attCount: sql`(SELECT COUNT(*) FROM attachments WHERE attachments.email_id = ${email.emailId})`.as('att_count')
		};

		const query = orm(c).select(selectFields).from(email);

		let conditions = [];

		if (emailId) {
			conditions.push(eq(email.emailId, Number(emailId)));
		}

		if (toEmail) {
			conditions.push(sql`${email.toEmail} COLLATE NOCASE LIKE ${toEmail}`);
		}

		if (sendEmail) {
			conditions.push(sql`${email.sendEmail} COLLATE NOCASE LIKE ${sendEmail}`);
		}

		if (sendName) {
			conditions.push(sql`${email.name} COLLATE NOCASE LIKE ${sendName}`);
		}

		if (subject) {
			conditions.push(sql`${email.subject} COLLATE NOCASE LIKE ${subject}`);
		}

		if (content) {
			conditions.push(sql`${email.content} COLLATE NOCASE LIKE ${content}`);
		}

		if (searchQuery) {
			conditions.push(or(
				sql`${email.subject} COLLATE NOCASE LIKE ${'%' + searchQuery + '%'}`,
				sql`${email.sendEmail} COLLATE NOCASE LIKE ${'%' + searchQuery + '%'}`,
				sql`${email.text} COLLATE NOCASE LIKE ${'%' + searchQuery + '%'}`
			));
		}

		if (since) {
			conditions.push(gte(email.createTime, since));
		}

		if (before) {
			conditions.push(lte(email.createTime, before));
		}

		if (type || type === 0) {
			conditions.push(eq(email.type, type));
		}

		if (isDel || isDel === 0) {
			conditions.push(eq(email.isDel, isDel));
		}

		if (conditions.length === 1) {
			query.where(...conditions);
		} else if (conditions.length > 1) {
			query.where(and(...conditions));
		}

		if (timeSort === 'asc') {
			query.orderBy(asc(email.emailId));
		} else {
			query.orderBy(desc(email.emailId));
		}

		return query.limit(size).offset(num);

	},

	async getEmailDetail(c, emailId) {
		const emailIdNum = Number(emailId);
		if (!emailIdNum || isNaN(emailIdNum)) {
			throw new BizError('Invalid email ID', 400);
		}

		const emailRow = await orm(c).select().from(email).where(eq(email.emailId, emailIdNum)).get();
		if (!emailRow) {
			throw new BizError('Email not found', 404);
		}

		const attList = await orm(c).select({
			attId: att.attId,
			filename: att.filename,
			mimeType: att.mimeType,
			size: att.size,
			key: att.key,
			disposition: att.disposition,
			contentId: att.contentId
		}).from(att).where(eq(att.emailId, emailIdNum)).all();

		const { r2Domain } = await settingService.query(c);

		const attachments = (attList || []).map(a => ({
			attId: a.attId,
			filename: a.filename || '',
			mimeType: a.mimeType || 'application/octet-stream',
			size: a.size || 0,
			key: a.key,
			disposition: a.disposition || 'attachment',
			contentId: a.contentId || '',
			url: r2Domain ? (r2Domain.endsWith('/') ? `${r2Domain}${a.key}` : `${r2Domain}/${a.key}`) : `/oss/${a.key}`
		}));

		return {
			emailId: emailRow.emailId,
			sendEmail: emailRow.sendEmail || '',
			sendName: emailRow.name || '',
			toEmail: emailRow.toEmail || '',
			toName: emailRow.toName || '',
			subject: emailRow.subject || '',
			createTime: emailRow.createTime,
			type: emailRow.type,
			status: emailRow.status,
			unread: emailRow.unread,
			isDel: emailRow.isDel,
			code: emailRow.code || '',
			messageId: emailRow.messageId || '',
			inReplyTo: emailRow.inReplyTo || '',
			relation: emailRow.relation || '',
			text: emailRow.text || '',
			content: emailRow.content || '',
			attachments
		};
	},

	async sendEmail(c, params) {
		const { from, sendEmail, to, receiveEmail, subject, text, content, html, cc, bcc, attachments = [] } = params;

		const targetReceivers = to || receiveEmail;
		if (!targetReceivers || (Array.isArray(targetReceivers) && targetReceivers.length === 0)) {
			throw new BizError('Recipient (to) is required', 400);
		}

		if (!subject) {
			throw new BizError('Subject is required', 400);
		}

		if (!text && !content && !html) {
			throw new BizError('Email body (text or content) is required', 400);
		}

		const rawFrom = from || sendEmail || c.env.admin;
		const fromAddress = rawFrom.includes('<') ? rawFrom.match(/<(.+?)>/)?.[1]?.trim() : rawFrom.trim();
		const fromName = rawFrom.includes('<') ? rawFrom.match(/^(.+?)\s*</)?.[1]?.trim() : (params.sendName || params.name || emailUtils.getName(fromAddress));

		let accountRow = await accountService.selectByEmailIncludeDel(c, fromAddress);

		let userId = 1;
		let accountId = 0;
		if (accountRow) {
			userId = accountRow.userId;
			accountId = accountRow.accountId;
		} else {
			const adminAccount = await accountService.selectByEmailIncludeDel(c, c.env.admin);
			if (adminAccount) {
				userId = adminAccount.userId;
				accountId = adminAccount.accountId;
			}
		}

		const toList = Array.isArray(targetReceivers) ? targetReceivers : [targetReceivers];
		const finalContent = content || html || `<pre>${text}</pre>`;
		const finalText = text || emailUtils.htmlToText(finalContent);

		const sendParams = {
			accountId,
			name: fromName,
			sendType: params.sendType || 'new',
			emailId: params.emailId,
			receiveEmail: toList,
			text: finalText,
			content: finalContent,
			subject,
			attachments
		};

		if (cc) {
			sendParams.cc = Array.isArray(cc) ? cc : [cc];
		}
		if (bcc) {
			sendParams.bcc = Array.isArray(bcc) ? bcc : [bcc];
		}

		const sendResult = await emailService.send(c, sendParams, userId);
		const emailRecord = Array.isArray(sendResult) ? sendResult[0] : sendResult;

		return {
			emailId: emailRecord?.emailId,
			status: 'sent',
			messageId: emailRecord?.messageId,
			sendEmail: fromAddress,
			toEmail: toList.join(', '),
			subject,
			createTime: emailRecord?.createTime
		};
	},

	async deleteEmail(c, emailId) {
		const emailIdNum = Number(emailId);
		if (!emailIdNum || isNaN(emailIdNum)) {
			throw new BizError('Invalid email ID', 400);
		}

		const emailRow = await orm(c).select().from(email).where(eq(email.emailId, emailIdNum)).get();
		if (!emailRow) {
			throw new BizError('Email not found', 404);
		}

		await orm(c).update(email).set({ isDel: isDel.DELETE }).where(eq(email.emailId, emailIdNum)).run();

		return { emailId: emailIdNum, deleted: true, isDel: isDel.DELETE };
	},

	async addUser(c, params) {
		const { list } = params;

		if (list.length === 0) return;

		for (const emailRow of list) {
			if (!verifyUtils.isEmail(emailRow.email)) {
				throw new BizError(t('notEmail'));
			}

			if (!c.env.domain.includes(emailUtils.getDomain(emailRow.email))) {
				throw new BizError(t('notEmailDomain'));
			}

			const { salt, hash } = await saltHashUtils.hashPassword(
				emailRow.password || cryptoUtils.genRandomPwd()
			);

			emailRow.salt = salt;
			emailRow.hash = hash;
		}


		const activeIp = reqUtils.getIp(c);
		const { os, browser, device } = reqUtils.getUserAgent(c);
		const activeTime = dayjs().format('YYYY-MM-DD HH:mm:ss');

		const roleList = await roleService.roleSelectUse(c);
		const defRole = roleList.find(roleRow => roleRow.isDefault === roleConst.isDefault.OPEN);

		const userList = [];

		for (const emailRow of list) {
			let { email, hash, salt, roleName } = emailRow;
			let type = defRole.roleId;

			if (roleName) {
				const roleRow = roleList.find(role => role.name === roleName);
				type = roleRow ? roleRow.roleId : type;
			}

			const userSql = `INSERT INTO user (email, password, salt, type, os, browser, active_ip, create_ip, device, active_time, create_time)
			VALUES ('${email}', '${hash}', '${salt}', '${type}', '${os}', '${browser}', '${activeIp}', '${activeIp}', '${device}', '${activeTime}', '${activeTime}')`

			const accountSql = `INSERT INTO account (email, name, user_id)
			VALUES ('${email}', '${emailUtils.getName(email)}', 0);`;

			userList.push(c.env.db.prepare(userSql));
			userList.push(c.env.db.prepare(accountSql));

		}

		userList.push(c.env.db.prepare(`UPDATE account SET user_id = (SELECT user_id FROM user WHERE user.email = account.email) WHERE user_id = 0;`))

		try {
			await c.env.db.batch(userList);
		} catch (e) {
			if(e.message.includes('SQLITE_CONSTRAINT')) {
				throw new BizError(t('emailExistDatabase'))
			} else {
				throw e
			}
		}

	},

	async genToken(c, params) {

		await this.verifyUser(c, params)

		const uuid = uuidv4();

		await c.env.kv.put(KvConst.PUBLIC_KEY, uuid);

		return {token: uuid}
	},

	async verifyUser(c, params) {

		const { email, password } = params

		const userRow = await userService.selectByEmailIncludeDel(c, email);

		if (email !== c.env.admin) {
			throw new BizError(t('notAdmin'));
		}

		if (!userRow || userRow.isDel === isDel.DELETE) {
			throw new BizError(t('notExistUser'));
		}

		if (!await cryptoUtils.verifyPassword(password, userRow.salt, userRow.password)) {
			throw new BizError(t('IncorrectPwd'));
		}
	}

}

export default publicService
