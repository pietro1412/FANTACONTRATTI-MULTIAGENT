/**
 * Script per invio email di benvenuto ai nuovi manager
 *
 * Uso:
 *   node scripts/send-welcome-email.cjs <email> [password]
 *
 * Esempi:
 *   node scripts/send-welcome-email.cjs mario@example.com
 *   node scripts/send-welcome-email.cjs mario@example.com MyPassword123!
 *
 * Configurazione richiesta in .env:
 *   GMAIL_USER=<email mittente>
 *   GMAIL_APP_PASSWORD=<app password gmail>
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Load .env manually (no dotenv dependency)
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (match) envVars[match[1].trim()] = match[2];
});

// ============================================
// CONFIGURAZIONE - Modifica questi valori
// ============================================
const PLATFORM_URL = 'https://fantacontratti-multiagent.vercel.app/';
const SUPPORT_EMAIL = 'fantacontrattiweb@gmail.com';
const DEFAULT_PASSWORD = 'Password123!';

// ============================================
// Parametri da riga di comando
// ============================================
const args = process.argv.slice(2);
const TO_EMAIL = args[0];
const PASSWORD = args[1] || DEFAULT_PASSWORD;

if (!TO_EMAIL) {
  console.error('Uso: node scripts/send-welcome-email.cjs <email> [password]');
  console.error('Esempio: node scripts/send-welcome-email.cjs mario@example.com');
  process.exit(1);
}

// Validazione email base
if (!TO_EMAIL.includes('@')) {
  console.error('ERROR: Email non valida:', TO_EMAIL);
  process.exit(1);
}

async function sendWelcomeEmail() {
  const user = envVars.GMAIL_USER || process.env.GMAIL_USER;
  const pass = envVars.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error('ERROR: GMAIL_USER o GMAIL_APP_PASSWORD non configurati in .env');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0b;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #1a1c20; border-radius: 16px; border: 1px solid #2d3139;">

          <!-- Header con logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px;">
              <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 50%; display: inline-block; line-height: 70px; font-size: 36px; text-align: center;">
                ⚽
              </div>
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 20px 0 0; letter-spacing: -0.5px;">
                Fantacontratti
              </h1>
              <p style="color: #9ca3af; font-size: 14px; margin: 5px 0 0;">
                Dynasty Fantasy Football
              </p>
            </td>
          </tr>

          <!-- Contenuto principale -->
          <tr>
            <td style="padding: 20px 40px 30px;">
              <h2 style="color: #f3f4f6; font-size: 20px; font-weight: 600; margin: 0 0 20px; text-align: center;">
                🎉 Benvenuto sulla piattaforma!
              </h2>

              <p style="color: #9ca3af; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                Ciao! Puoi ora accedere alla piattaforma Fantacontratti utilizzando le credenziali seguenti:
              </p>

              <!-- Credenziali box -->
              <div style="background-color: #111214; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #2d3139;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Link Piattaforma</span>
                      <p style="color: #3b82f6; font-size: 14px; margin: 5px 0 0; word-break: break-all;">
                        <a href="${PLATFORM_URL}" style="color: #3b82f6; text-decoration: none;">${PLATFORM_URL}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-top: 1px solid #2d3139;">
                      <span style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Password di default</span>
                      <p style="color: #fbbf24; font-size: 18px; font-weight: bold; margin: 5px 0 0; font-family: monospace;">
                        ${PASSWORD}
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Avviso cambio password -->
              <div style="background-color: #422006; border-radius: 8px; padding: 15px; margin-bottom: 25px; border-left: 3px solid #f59e0b;">
                <p style="color: #fbbf24; font-size: 14px; margin: 0; font-weight: 600;">
                  ⚠️ Importante: Cambia la password
                </p>
                <p style="color: #fcd34d; font-size: 13px; margin: 8px 0 0; line-height: 1.5;">
                  Per motivi di sicurezza, ti consigliamo di cambiare la password al primo accesso.
                  Vai su <strong>Profilo</strong> (cliccando sul tuo nome in alto a destra) e seleziona <strong>"Cambia Password"</strong>.
                </p>
              </div>

              <!-- Pulsante CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px;">
                    <a href="${PLATFORM_URL}"
                       style="display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a);
                              color: #ffffff; font-size: 16px; font-weight: 600;
                              text-decoration: none; padding: 14px 32px; border-radius: 8px;
                              box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);">
                      🚀 Accedi alla Piattaforma
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Situazione Lega -->
              <h3 style="color: #f3f4f6; font-size: 16px; font-weight: 600; margin: 0 0 15px; border-top: 1px solid #2d3139; padding-top: 25px;">
                📋 Situazione attuale della Lega
              </h3>

              <div style="background-color: #111214; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div style="margin-bottom: 15px;">
                  <span style="display: inline-block; background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #000; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
                    Fase Attuale
                  </span>
                  <p style="color: #ffffff; font-size: 15px; font-weight: 600; margin: 10px 0 5px;">
                    🏆 Assegnazione Premi Budget
                  </p>
                  <p style="color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.5;">
                    L'admin della lega sta assegnando i premi budget a ciascun manager.
                  </p>
                </div>

                <!-- Cosa puoi fare ora -->
                <div style="border-top: 1px solid #2d3139; padding-top: 15px; margin-bottom: 15px;">
                  <span style="display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
                    Cosa puoi fare ora
                  </span>
                  <ul style="color: #9ca3af; font-size: 13px; margin: 10px 0 0; padding-left: 20px; line-height: 1.8;">
                    <li>Consultare le <strong style="color: #fff;">rose della lega</strong> con tutti i giocatori</li>
                    <li>Visualizzare le <strong style="color: #fff;">statistiche dei giocatori</strong> di Serie A</li>
                  </ul>
                </div>

                <div style="border-top: 1px solid #2d3139; padding-top: 15px;">
                  <span style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
                    Prossima Fase
                  </span>
                  <p style="color: #ffffff; font-size: 15px; font-weight: 600; margin: 10px 0 5px;">
                    📝 Rinnovo Contratti
                  </p>
                  <p style="color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.5;">
                    Appena l'admin consoliderà la fase premi, vedrai una nuova sezione <strong style="color: #fff;">Rinnovo Contratti</strong>.
                  </p>
                </div>
              </div>

              <!-- Info giocatori indennizzati -->
              <div style="background-color: #0c4a6e; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 3px solid #0ea5e9;">
                <p style="color: #7dd3fc; font-size: 14px; margin: 0; font-weight: 600;">
                  ℹ️ Giocatori Indennizzati
                </p>
                <p style="color: #bae6fd; font-size: 13px; margin: 10px 0 0; line-height: 1.6;">
                  Nella fase di rinnovo contratti, per ogni giocatore uscito dalla lista (ESTERO o RETROCESSO) dovrai scegliere:
                </p>
                <ul style="color: #bae6fd; font-size: 13px; margin: 10px 0 0; padding-left: 20px; line-height: 1.8;">
                  <li><strong style="color: #22c55e;">LIBERA</strong> → Il giocatore viene svincolato e ricevi l'indennizzo</li>
                  <li><strong style="color: #f59e0b;">MANTIENI</strong> → Il giocatore resta in rosa, continui a pagare il contratto ma perdi l'indennizzo</li>
                </ul>
              </div>

              <!-- Tabellone rinnovi -->
              <div style="background-color: #1e1b4b; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 3px solid #8b5cf6;">
                <p style="color: #c4b5fd; font-size: 14px; margin: 0; font-weight: 600;">
                  📊 Tabellone Rinnovi in Tempo Reale
                </p>
                <p style="color: #ddd6fe; font-size: 13px; margin: 10px 0 0; line-height: 1.6;">
                  Dopo aver gestito i giocatori indennizzati, potrai studiare come rinnovare i contratti grazie a un <strong>tabellone in tempo reale</strong> che ti aiuterà nei calcoli e nella pianificazione del budget.
                </p>
              </div>

              <!-- Segnalazione problemi -->
              <h3 style="color: #f3f4f6; font-size: 16px; font-weight: 600; margin: 0 0 15px; border-top: 1px solid #2d3139; padding-top: 25px;">
                🛠️ Problemi o Feedback?
              </h3>

              <div style="background-color: #111214; border-radius: 12px; padding: 20px;">
                <p style="color: #9ca3af; font-size: 13px; margin: 0 0 15px; line-height: 1.6;">
                  La piattaforma è in continuo sviluppo e il tuo feedback è prezioso! Se riscontri problemi o hai suggerimenti:
                </p>

                <div style="background-color: #1a1c20; border-radius: 8px; padding: 15px; margin-bottom: 12px;">
                  <p style="color: #f3f4f6; font-size: 14px; margin: 0 0 8px; font-weight: 600;">
                    ✉️ Scrivi al Supporto
                  </p>
                  <p style="color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.5;">
                    Invia una mail a <a href="mailto:${SUPPORT_EMAIL}" style="color: #3b82f6; text-decoration: none; font-weight: 600;">${SUPPORT_EMAIL}</a> descrivendo:
                  </p>
                  <ul style="color: #9ca3af; font-size: 12px; margin: 8px 0 0; padding-left: 18px; line-height: 1.6;">
                    <li>Cosa stavi facendo</li>
                    <li>Cosa è successo (errore, comportamento inatteso)</li>
                    <li>Se possibile, allega uno screenshot</li>
                  </ul>
                </div>

                <div style="background-color: #1a1c20; border-radius: 8px; padding: 15px;">
                  <p style="color: #f3f4f6; font-size: 14px; margin: 0 0 8px; font-weight: 600;">
                    💡 Suggerimenti e Migliorie
                  </p>
                  <p style="color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.5;">
                    Hai un'idea per migliorare la piattaforma? Condividila! Ogni suggerimento viene valutato e, se utile, inserito nella roadmap di sviluppo.
                  </p>
                </div>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px; border-top: 1px solid #2d3139;">
              <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">
                Questa email è stata inviata da Fantacontratti.<br>
                Per qualsiasi domanda, contatta l'admin della tua lega.
              </p>
              <p style="color: #4b5563; font-size: 11px; text-align: center; margin: 15px 0 0;">
                © ${new Date().getFullYear()} Fantacontratti. Tutti i diritti riservati.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    console.log('📧 Invio email di benvenuto...');
    console.log('   Destinatario:', TO_EMAIL);
    console.log('   Password:', PASSWORD);
    console.log('   Mittente:', user);

    const result = await transporter.sendMail({
      from: `"Fantacontratti" <${user}>`,
      to: TO_EMAIL,
      subject: '🎉 Benvenuto su Fantacontratti - Accesso e Istruzioni',
      html: htmlContent,
    });

    console.log('\n✅ Email inviata con successo!');
    console.log('   Message ID:', result.messageId);
  } catch (error) {
    console.error('\n❌ Errore invio email:', error.message);
    process.exit(1);
  }
}

sendWelcomeEmail();
