import { pollMail } from '../index.mjs';
import { required, openInbox } from './inbox.mjs';

const host = required('MAIL_HOST');
const username = required('MAIL_USER');
const port = Number(process.env.MAIL_PORT || 995);
const inbox = openInbox(['email', host, port, username]);
const count = await pollMail({ host, port, username, password: required('MAIL_PASSWORD') }, {
  limit: 20,
  hasSeen: id => inbox.has(id),
  onMessage: mail => inbox.save(mail.id, mail.raw)
});
console.log('本轮归档邮件数', count);
