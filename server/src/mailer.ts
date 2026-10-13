import nodemailer from 'nodemailer'
import type { Config } from './config.ts'

/** Sends the few e-mails of Codex (password reset). */
export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>
}

/** SMTP when configured; printed to the console in development; otherwise none. */
export function createMailer(config: Config): Mailer | null {
  if (config.smtpUrl) {
    const transport = nodemailer.createTransport(config.smtpUrl)
    return {
      async send(to, subject, text) {
        await transport.sendMail({ from: config.mailFrom, to, subject, text })
      },
    }
  }
  if (config.dev)
    return {
      async send(to, subject, text) {
        console.info(`[e-mail to ${to}] ${subject}\n${text}`)
      },
    }
  return null
}

/** Keeps e-mails in memory (tests). */
export function memoryMailer(): Mailer & { sent: { to: string; subject: string; text: string }[] } {
  const sent: { to: string; subject: string; text: string }[] = []
  return {
    sent,
    async send(to, subject, text) {
      sent.push({ to, subject, text })
    },
  }
}
