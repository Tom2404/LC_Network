import os
import uuid
from werkzeug.utils import secure_filename
from flask import current_app
from PIL import Image

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'}

def allowed_file(filename, file_type='image'):
    """Check if file extension is allowed"""
    if not filename or '.' not in filename:
        return False
    
    ext = filename.rsplit('.', 1)[1].lower()
    
    if file_type == 'image':
        return ext in ALLOWED_IMAGE_EXTENSIONS
    elif file_type == 'video':
        return ext in ALLOWED_VIDEO_EXTENSIONS
    else:
        return ext in (ALLOWED_IMAGE_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS)


def upload_file(file, folder='uploads'):
    """
    Upload file to local storage
    Returns: URL of uploaded file
    TODO: Implement AWS S3 upload in production
    """
    try:
        if not file or file.filename == '':
            raise ValueError("No file provided")
        
        # Secure the filename
        original_filename = secure_filename(file.filename)
        ext = original_filename.rsplit('.', 1)[1].lower()
        
        # Generate unique filename
        unique_filename = f"{uuid.uuid4().hex}.{ext}"
        
        # Create upload directory if not exists
        upload_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], folder)
        os.makedirs(upload_folder, exist_ok=True)
        
        # Save file
        file_path = os.path.join(upload_folder, unique_filename)
        file.save(file_path)
        
        # If image, optionally resize/optimize
        if ext in ALLOWED_IMAGE_EXTENSIONS:
            optimize_image(file_path)
        
        # Return relative URL
        file_url = f"/uploads/{folder}/{unique_filename}"
        return file_url
        
    except Exception as e:
        raise Exception(f"File upload failed: {str(e)}")


def optimize_image(file_path, max_width=1920, max_height=1080, quality=85):
    """Optimize image size and quality"""
    try:
        with Image.open(file_path) as img:
            # Convert RGBA to RGB if necessary
            if img.mode == 'RGBA':
                img = img.convert('RGB')
            
            # Resize if too large
            if img.width > max_width or img.height > max_height:
                img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
            
            # Save with optimization
            img.save(file_path, optimize=True, quality=quality)
            
    except Exception as e:
        print(f"Image optimization failed: {e}")


def delete_file(file_url):
    """Delete file from storage"""
    try:
        if not file_url:
            return False
        
        # Extract file path from URL
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], file_url.replace('/uploads/', ''))
        
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        
        return False
        
    except Exception as e:
        print(f"File deletion failed: {e}")
        return False


def get_file_info(file):
    """Get file metadata"""
    try:
        file_size = 0
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        width, height, duration = None, None, None
        
        ext = file.filename.rsplit('.', 1)[1].lower()
        if ext in ALLOWED_IMAGE_EXTENSIONS:
            with Image.open(file) as img:
                width, height = img.size
        
        return {
            'file_size': file_size,
            'width': width,
            'height': height,
            'duration': duration
        }
        
    except Exception as e:
        print(f"Failed to get file info: {e}")
        return {}


# TODO: AWS S3 Upload (for production)
def upload_to_s3(file, folder='uploads'):
    """Upload file to AWS S3"""
    import boto3
    from botocore.exceptions import NoCredentialsError
    
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=current_app.config['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=current_app.config['AWS_SECRET_ACCESS_KEY'],
            region_name=current_app.config['AWS_REGION']
        )
        
        original_filename = secure_filename(file.filename)
        ext = original_filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{folder}/{uuid.uuid4().hex}.{ext}"
        
        s3_client.upload_fileobj(
            file,
            current_app.config['AWS_S3_BUCKET'],
            unique_filename,
            ExtraArgs={'ACL': 'public-read'}
        )
        
        file_url = f"https://{current_app.config['AWS_S3_BUCKET']}.s3.{current_app.config['AWS_REGION']}.amazonaws.com/{unique_filename}"
        return file_url
        
    except NoCredentialsError:
        raise Exception("AWS credentials not available")
    except Exception as e:
        raise Exception(f"S3 upload failed: {str(e)}")
