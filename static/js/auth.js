document.addEventListener('DOMContentLoaded', function() {
    // Check authentication status on page load
    checkAuthStatus();

    // Handle login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(loginForm);
            fetch('/login', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/';
                } else {
                    alert(data.message || 'Login failed');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred during login');
            });
        });
    }

    // Handle register form submission
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(registerForm);
            fetch('/register', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/';
                } else {
                    alert(data.message || 'Registration failed');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred during registration');
            });
        });
    }

    // Handle logout button click
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            fetch('/logout')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        window.location.reload();
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('An error occurred during logout');
                });
        });
    }
});

function checkAuthStatus() {
    fetch('/check-auth')
        .then(response => response.json())
        .then(data => {
            const userNameSpan = document.getElementById('userName');
            const logoutBtn = document.getElementById('logoutBtn');
            
            if (data.authenticated) {
                userNameSpan.textContent = data.name;
                logoutBtn.style.display = 'inline-block';
            } else {
                userNameSpan.textContent = 'Guest';
                logoutBtn.style.display = 'none';
                // If not on login or register page, redirect to login
                if (!window.location.pathname.includes('/login') && 
                    !window.location.pathname.includes('/register')) {
                    window.location.href = '/login';
                }
            }
        })
        .catch(error => {
            console.error('Error checking auth status:', error);
        });
}
