from flask_mail import Message
from flask import current_app

def send_otp_email(to_email, full_name, otp_code):
    """Send OTP code for registration verification"""
    from extensions import mail
    
    try:
        msg = Message(
            subject='Mã OTP Đăng Ký - LC Network',
            recipients=[to_email],
            html=f"""
            <html>
                <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f6f8f8;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #111817; margin-bottom: 20px;">Xin chào {full_name}!</h2>
                        <p style="color: #618986; font-size: 16px; line-height: 1.6;">
                            Cảm ơn bạn đã đăng ký tài khoản tại <strong style="color: #13ecda;">LC Network</strong>.
                        </p>
                        <p style="color: #618986; font-size: 16px; line-height: 1.6;">
                            Để hoàn tất đăng ký, vui lòng nhập mã OTP sau:
                        </p>
                        <div style="background-color: #f0f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
                            <h1 style="color: #13ecda; font-size: 42px; letter-spacing: 8px; margin: 0; font-weight: bold;">
                                {otp_code}
                            </h1>
                        </div>
                        <p style="color: #618986; font-size: 14px; line-height: 1.6;">
                            <strong>Lưu ý:</strong> Mã OTP này có hiệu lực trong <strong>5 phút</strong>.
                        </p>
                        <p style="color: #618986; font-size: 14px; line-height: 1.6;">
                            Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email này.
                        </p>
                        <hr style="border: none; border-top: 1px solid #f0f4f4; margin: 30px 0;">
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            © 2026 LC Network. Bảo lưu mọi quyền.<br>
                            Email tự động, vui lòng không trả lời.
                        </p>
                    </div>
                </body>
            </html>
            """
        )
        
        mail.send(msg)
        return True
        
    except Exception as e:
        print(f"Failed to send OTP email: {e}")
        return False


def send_verification_email(to_email, username, token):
    """Send email verification link"""
    from extensions import mail
    
    try:
        verification_url = f"{current_app.config.get('FRONTEND_URL', 'http://localhost:3000')}/verify-email/{token}"
        
        msg = Message(
            subject='Verify Your Email - Social Media',
            recipients=[to_email],
            html=f"""
            <html>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Welcome to Social Media, {username}!</h2>
                    <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
                    <a href="{verification_url}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                        Verify Email
                    </a>
                    <p>Or copy and paste this link into your browser:</p>
                    <p>{verification_url}</p>
                    <p>This link will expire in 24 hours.</p>
                    <p>If you didn't create this account, please ignore this email.</p>
                    <hr>
                    <p style="color: #666; font-size: 12px;">This is an automated email, please do not reply.</p>
                </body>
            </html>
            """
        )
        
        mail.send(msg)
        return True
        
    except Exception as e:
        print(f"Failed to send verification email: {e}")
        return False


def send_password_reset_email(to_email, username, token):
    """Send password reset link"""
    from extensions import mail
    
    try:
        reset_url = f"{current_app.config.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password/{token}"
        
        msg = Message(
            subject='Reset Your Password - Social Media',
            recipients=[to_email],
            html=f"""
            <html>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Password Reset Request</h2>
                    <p>Hi {username},</p>
                    <p>We received a request to reset your password. Click the button below to reset it:</p>
                    <a href="{reset_url}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                        Reset Password
                    </a>
                    <p>Or copy and paste this link into your browser:</p>
                    <p>{reset_url}</p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
                    <hr>
                    <p style="color: #666; font-size: 12px;">This is an automated email, please do not reply.</p>
                </body>
            </html>
            """
        )
        
        mail.send(msg)
        return True
        
    except Exception as e:
        print(f"Failed to send password reset email: {e}")
        return False


def send_violation_notification(to_email, username, violation_type, reason):
    """Send notification about content violation"""
    from extensions import mail
    
    try:
        msg = Message(
            subject='Content Violation Notice - Social Media',
            recipients=[to_email],
            html=f"""
            <html>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Content Violation Notice</h2>
                    <p>Hi {username},</p>
                    <p>We're writing to inform you that your content has been flagged for violating our community guidelines.</p>
                    <p><strong>Violation Type:</strong> {violation_type}</p>
                    <p><strong>Reason:</strong> {reason}</p>
                    <p>Please review our community guidelines and ensure your future posts comply with our policies.</p>
                    <p>If you believe this decision was made in error, you can appeal this action within 7 days.</p>
                    <a href="{current_app.config.get('FRONTEND_URL', 'http://localhost:3000')}/appeals" style="display: inline-block; padding: 10px 20px; background-color: #ffc107; color: black; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                        Submit Appeal
                    </a>
                    <hr>
                    <p style="color: #666; font-size: 12px;">This is an automated email, please do not reply.</p>
                </body>
            </html>
            """
        )
        
        mail.send(msg)
        return True
        
    except Exception as e:
        print(f"Failed to send violation notification: {e}")
        return False
