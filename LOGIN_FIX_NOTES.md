# Login fix notes

Changes included:

1. Login inputs have stable IDs/names so the handler reads the correct username and password.
2. Password is still read correctly after pressing the eye icon.
3. The role login handler now sends the raw username/email value to the backend.
   - Before, nested role pages converted `admin@gmail.com` into `admin`, which caused `Bad credentials` when the database account was stored by email.
4. Login error/success messages are visible.
