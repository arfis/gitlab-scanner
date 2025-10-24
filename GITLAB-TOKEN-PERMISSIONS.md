# GitLab Token Permissions

## Required Permissions for Library Updates

When using the library update feature, your GitLab API token must have the following permissions:

### Minimum Required Scopes

1. **`api`** - Full API access
   - Required for: Reading project details, file contents, creating merge requests
   - This is the primary scope needed for all operations

OR (more restrictive):

2. **`read_api`** - Read-only API access
   - Required for: Reading project details and file contents
   
3. **`write_repository`** - Write access to repositories
   - Required for: Pushing code changes to branches
   
4. **`write_merge_request`** (if available) - Create merge requests
   - Required for: Creating merge requests after updates

### Recommended Approach

For simplicity, use a **Personal Access Token** with the **`api`** scope enabled. This provides all necessary permissions.

## Creating a Personal Access Token

1. Go to your GitLab instance (e.g., `https://git.prosoftke.sk`)
2. Navigate to **User Settings** → **Access Tokens**
3. Click **Add new token**
4. Configure the token:
   - **Token name**: `gitlab-list-updater` (or any descriptive name)
   - **Expiration date**: Set according to your security policy
   - **Select scopes**: ✅ **api**
5. Click **Create personal access token**
6. **Copy the token immediately** (you won't be able to see it again)

## Using the Token

### In the Web Interface

1. Open the web interface at `http://localhost:8100`
2. Expand **Advanced Configuration**
3. Paste your token in the **GitLab API Token** field
4. Click **Save Configuration**
5. (Optional) Click **Test Connection** to verify

### In Environment Variables

```bash
export GITLAB_TOKEN="your-token-here"
export GITLAB_URL="https://git.prosoftke.sk"
make start
```

## Troubleshooting

### Error: "exit status 128"

This error occurs when git clone fails, usually due to:

1. **Missing or invalid token** - Ensure your token is correctly configured
2. **Insufficient permissions** - The token must have `api` scope
3. **Expired token** - Check if your token has expired and create a new one
4. **Network issues** - Ensure you can reach the GitLab server

### Error: "HTTP 401"

This indicates authentication failure:

1. **Token not provided** - Make sure you're sending the token in API requests
2. **Invalid token format** - Token should be sent as `Bearer <token>` in Authorization header
3. **Token revoked** - The token may have been revoked in GitLab settings

### Error: "HTTP 403"

This indicates authorization failure:

1. **Insufficient permissions** - Your token needs the `api` scope
2. **Project access** - Ensure the token owner has Developer or Maintainer role in the project
3. **Protected branches** - You may need Maintainer role to push to protected branches

## Project Access Requirements

Beyond token scopes, the user who owns the token must have:

- **Minimum Role**: Developer
- **Recommended Role**: Maintainer (required for protected branches)

The user needs:
- Read access to project details and files
- Write access to create branches
- Permission to create merge requests

## Security Best Practices

1. **Use token expiration** - Set tokens to expire after a reasonable period
2. **Rotate tokens regularly** - Create new tokens and revoke old ones periodically
3. **Limit scope** - Use the minimum required scopes (though `api` is typically needed)
4. **Store securely** - Never commit tokens to git repositories
5. **Use environment variables** - Store tokens in `.env` or environment variables
6. **Revoke unused tokens** - Remove tokens that are no longer needed

## Token Storage

Your token is stored:
- **Frontend**: In browser localStorage (cleared when you clear browser data)
- **Backend**: In memory only (not persisted to disk)

**Note**: Tokens are never stored in files or databases by this application.

