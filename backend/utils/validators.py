import re
from email.utils import parseaddr

def validate_email(email):
    """Validate email format"""
    if not email:
        return False
    
    # Basic regex pattern for email
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if not re.match(pattern, email):
        return False
    
    # Additional check using parseaddr
    name, addr = parseaddr(email)
    return addr == email


def validate_password(password):
    """
    Validate password strength
    Requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    if not password:
        return False, "Password is required"
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    
    return True, "Password is strong"


def validate_username(username):
    """
    Validate username format
    Requirements:
    - 3-20 characters
    - Only alphanumeric and underscore
    - Must start with a letter
    """
    if not username:
        return False, "Username is required"
    
    if len(username) < 3 or len(username) > 20:
        return False, "Username must be between 3 and 20 characters"
    
    pattern = r'^[a-zA-Z][a-zA-Z0-9_]*$'
    if not re.match(pattern, username):
        return False, "Username must start with a letter and contain only letters, numbers, and underscores"
    
    return True, "Username is valid"
