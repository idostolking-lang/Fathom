# 📧 Email Lead Sender - Setup Guide

## How to Configure Email Sending

The Email Lead Sender feature allows you to send professional emails to your leads directly from the app. Follow these steps to set it up:

---

## Step 1: Create a Gmail App Password

For security reasons, Gmail requires you to use an **App Password** instead of your regular password.

### Instructions:

1. **Go to your Google Account**: https://myaccount.google.com/
2. **Enable 2-Step Verification** (if not already enabled):
   - Go to **Security** → **2-Step Verification**
   - Follow the steps to enable it
3. **Create an App Password**:
   - Go to **Security** → **App passwords** (https://myaccount.google.com/apppasswords)
   - Select "Mail" as the app and "Other" as the device
   - Enter "Fathom" as the device name
   - Click **Generate**
   - **Copy the 16-character password** (you won't see it again!)

---

## Step 2: Add Email Credentials to `.env` File

1. Open or create a file named **`.env`** in your project root directory
2. Add the following lines:

```env
# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password-here
EMAIL_FROM_NAME=Your Name or Business Name
```

### Example:

```env
# Email Configuration
EMAIL_USER=john@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
EMAIL_FROM_NAME=John's Marketing
```

**⚠️ Important:**
- Replace `your-email@gmail.com` with your actual Gmail address
- Replace `your-app-password-here` with the 16-character App Password you generated
- The App Password should have spaces removed (e.g., `abcdefghijklmnop`)
- **Never share your `.env` file publicly!** Add it to `.gitignore`

---

## Step 3: Restart the Server

After adding your email credentials:

```bash
npm start
```

You should see this message:

```
Email sender configured from environment.
```

If you see a warning, check that your `.env` file is correct.

---

## Step 4: Test the Email Sender

1. Click **"Lead Sender (Email)"** button on the dashboard
2. Select a table that has "email" in its name
3. Choose "Send to All" or "Send to Specific"
4. Compose your message and send!

---

## 🔒 Security Tips

1. **Never commit `.env` to Git**
   - Add `.env` to your `.gitignore` file
   - Keep your App Password private

2. **Use a dedicated Gmail account**
   - Consider creating a separate Gmail account for business/marketing
   - Don't use your personal email

3. **Gmail sending limits:**
   - Free Gmail accounts: ~500 emails per day
   - Google Workspace accounts: ~2,000 emails per day
   - The app adds a small delay between emails to avoid hitting limits

---

## 🚨 Troubleshooting

### "Email not configured" error
- Make sure `.env` file exists in the project root
- Check that `EMAIL_USER` and `EMAIL_PASS` are set correctly
- Restart the server after changing `.env`

### "Invalid credentials" error
- Make sure you're using an **App Password**, not your regular Gmail password
- Remove any spaces from the App Password
- Check that 2-Step Verification is enabled on your Google Account

### Emails not arriving
- Check your sent folder in Gmail
- The email might be in the recipient's spam folder
- Make sure the email address is valid
- Check Gmail's sending limits (500/day for free accounts)

### "Less secure app access" error
- Google deprecated this method. You **must** use App Passwords now
- Follow Step 1 above to create an App Password

---

## 📚 Your Complete `.env` File

Your `.env` file should look like this:

```env
# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# Instagram Credentials (Optional)
ENABLE_INSTAGRAM_AUTOMATION=false

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
EMAIL_FROM_NAME=Your Business Name

# Server Port
PORT=7000
HOST=0.0.0.0

# Required when HOST=0.0.0.0
APP_ACCESS_TOKEN=replace-with-a-long-random-dashboard-token
```

---

## ✅ You're Ready!

Once configured, you can:
- ✅ Send personalized emails to all leads
- ✅ Send to specific contacts from your email tables
- ✅ Track sent/failed emails in real-time
- ✅ Professional HTML-formatted emails
- ✅ Automatic retry and error handling

**Happy emailing!** 📧✨

