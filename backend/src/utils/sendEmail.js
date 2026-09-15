const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: "gmail", // or use SendGrid/Mailgun if needed
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: '"YourApp Support" <no-reply@yourapp.com>',
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
/*
 //https://sendgrid.com
//npm install @sendgrid/mail
//password: A#70#23@!-a
// username: abbassani2023@outlook.com

const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY); // Store this in your .env

const sendEmail = async (options) => {
  const msg = {
    to: options.email,
    from: "no-reply@yourapp.com", // Must be verified in SendGrid or use a domain you verified
    subject: options.subject,
    html: options.message,
  };

  await sgMail.send(msg);
};

module.exports = sendEmail;
*/
