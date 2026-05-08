import os
import random
import string
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
# Use a generic domain for now until you verify a custom one in SendGrid
FROM_EMAIL = "auth@legendscbb.com" 

def send_legends_email(to_email: str, subject: str, html_content: str):
    if not SENDGRID_API_KEY:
        print("!!! MAIL_ERROR: SENDGRID_API_KEY not set. Check Render Env Vars.")
        return False

    message = Mail(
        from_email=FROM_EMAIL,
        to_emails=to_email,
        subject=subject,
        html_content=html_content
    )
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        sg.send(message)
        return True
    except Exception as e:
        print(f"!!! SENDGRID_FAILURE: {e}")
        return False

def send_welcome_email(to_email: str, username: str):
    subject = "Welcome to the Legends Universe"
    # Simple, branded HTML template
    content = f"""
    <div style="font-family: sans-serif; color: #333;">
        <h2>Welcome to the League, @{username}!</h2>
        <p>Your identity has been successfully registered in the <b>Legends CBB Simulation Universe</b>.</p>
        <p>You can now create brackets, follow programs, and track sim results in real-time.</p>
        <hr/>
        <p style="font-size: 12px; color: #888;">Legends CBB v1.0 • Legacy Simulation Engine</p>
    </div>
    """
    return send_legends_email(to_email, subject, content)

def send_reset_code_email(to_email: str, code: str):
    subject = "Legends CBB: Password Reset Code"
    content = f"""
    <div style="font-family: sans-serif; text-align: center;">
        <h1>{code}</h1>
        <p>Enter this 6-digit code in the app to reset your password.</p>
        <p style="color: #666;">This code will expire in 15 minutes.</p>
    </div>
    """
    return send_legends_email(to_email, subject, content)
