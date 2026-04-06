/** 
 * Cấu hình Tailwind CSS cho Admin Dashboard
 */
tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#11d4c4",
                "primary-dark": "#0fb9aa",
                "background-light": "#f6f8f8",
                "background-dark": "#102220",
                "success": "#28a745",
                "warning": "#ffc107",
                "danger": "#dc3545",
                "muted": "#6c757d"
            },
            fontFamily: {
                "display": ["Manrope", "sans-serif"]
            },
            borderRadius: {
                "DEFAULT": "0.375rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "2xl": "1rem",
                "full": "9999px"
            },
            keyframes: {
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'scale-in': {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                }
            },
            animation: {
                'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
                'fade-in': 'fade-in 0.3s ease-out forwards',
                'scale-in': 'scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }
        }
    }
}
