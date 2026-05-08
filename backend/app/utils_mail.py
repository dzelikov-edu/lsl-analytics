import os
import resend

# We will set RESEND_API_KEY in Render Environment Variables
resend.api_key = os.environ.get("RESEND_API_KEY")

# For Beta/Testing, Resend allows 'onboarding@resend.dev' 
# until you verify a custom domain.
FROM_EMAIL = "Legends CBB <onboarding@resend.dev>"

def send_legends_email(to_email: str, subject: str, html_content: str):
    if not resend.api_key:
        print("!!! MAIL_ERROR: RESEND_API_KEY not set. Check Render Env Vars.")
        return False

    try:
        params = {
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        resend.Emails.send(params)
        return True
    except Exception as e:
        print(f"!!! RESEND_FAILURE: {e}")
        return False

def send_welcome_email(to_email: str, username: str):
    subject = "Welcome to the Legends Universe"
    content = f"""
    <div style="font-family: sans-serif; color: #333; padding: 20px;">
        <h2 style="color: #007AFF;">Welcome to the League, @{username}!</h2>
        <p>Your identity has been successfully registered in the <b>Legends CBB Simulation Universe</b>.</p>
        <p>You can now create brackets, follow programs, and track sim results in real-time.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #888; text-align: center;">
            Legends CBB v1.0 • Powered by the Legacy Simulation Engine
        </p>
    </div>
    """
    return send_legends_email(to_email, subject, content)

def send_reset_code_email(to_email: str, code: str):
    subject = "Legends CBB: Password Reset Code"
    content = f"""
    <div style="font-family: sans-serif; text-align: center; padding: 20px;">
        <p style="font-size: 16px; color: #555;">Use the code below to reset your password:</p>
        <h1 style="font-size: 48px; letter-spacing: 5px; color: #007AFF; margin: 20px 0;">{code}</h1>
        <p style="color: #888; font-size: 13px;">This code will expire in 15 minutes.</p>
        <p style="color: #888; font-size: 11px; margin-top: 30px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
    """
    return send_legends_email(to_email, subject, content)
