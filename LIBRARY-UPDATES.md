# 📦 Library Update System

## Overview

The Library Update System automates the process of updating Go libraries in your GitLab projects and creating merge requests with the changes. This system handles:

- **Detecting outdated libraries** in your projects
- **Updating go.mod and go.sum** files automatically
- **Creating merge requests** with detailed change information
- **Batch updating** multiple libraries at once

## 🚀 Features

### ✅ What It Does
- **Automated Library Detection**: Scans projects for outdated Go libraries
- **Smart Updates**: Updates `go.mod` and `go.sum` files using `go get`
- **Merge Request Creation**: Automatically creates MRs with detailed descriptions
- **Batch Operations**: Update multiple libraries in one operation
- **Change Tracking**: Shows detailed diffs of what changed
- **Branch Management**: Creates feature branches for each update

### 🔧 How It Works

1. **Clone Repository**: Creates a temporary clone of your project
2. **Update Libraries**: Uses `go get` to update specific libraries
3. **Generate Changes**: Calculates diffs for go.mod and go.sum
4. **Create Branch**: Creates a new branch for the update
5. **Commit Changes**: Commits with descriptive messages
6. **Push & Create MR**: Pushes changes and creates merge request

## 📋 API Endpoints

### Check Outdated Libraries
```http
GET /api/library/outdated/{project_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "project_id": 123,
  "updates": [
    {
      "library_name": "github.com/gin-gonic/gin",
      "current_version": "v1.8.1",
      "latest_version": "v1.9.1"
    }
  ],
  "count": 1
}
```

### Update Single Library
```http
POST /api/library/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "project_id": 123,
  "library_name": "github.com/gin-gonic/gin",
  "target_version": "v1.9.1"
}
```

**Response:**
```json
{
  "project_id": 123,
  "project_name": "my-project",
  "success": true,
  "message": "Successfully updated github.com/gin-gonic/gin to v1.9.1",
  "merge_request": {
    "id": 456,
    "iid": 12,
    "title": "Update github.com/gin-gonic/gin to v1.9.1",
    "web_url": "https://gitlab.com/group/project/-/merge_requests/12"
  },
  "changes": {
    "go_mod_changes": "- github.com/gin-gonic/gin v1.8.1\n+ github.com/gin-gonic/gin v1.9.1",
    "go_sum_changes": "Updated checksums...",
    "files_changed": ["go.mod", "go.sum"]
  }
}
```

### Batch Update Libraries
```http
POST /api/library/batch-update
Authorization: Bearer <token>
Content-Type: application/json

{
  "project_id": 123,
  "updates": [
    {
      "library_name": "github.com/gin-gonic/gin",
      "latest_version": "v1.9.1"
    }
  ]
}
```

## 🎯 Frontend Interface

### Library Update Management Section

The frontend provides a comprehensive interface for managing library updates:

#### 1. **Check Outdated Libraries**
- Enter Project ID
- Click "🔍 Check Outdated Libraries"
- View list of outdated libraries with current and latest versions

#### 2. **Update Single Library**
- Enter Project ID, Library Name, and Target Version
- Click "🚀 Update Library"
- View results with merge request links

#### 3. **Batch Update All**
- Click "📦 Batch Update All"
- Updates all outdated libraries at once
- Creates multiple merge requests

#### 4. **Status Monitoring**
- Click "🔄 Refresh Status"
- Check update status and progress

## 🔧 Configuration

### Prerequisites

1. **Git Access**: The system needs Git installed and configured
2. **GitLab Token**: Valid GitLab API token with repository access
3. **SSH Keys**: Proper SSH keys for Git operations (or use HTTPS with tokens)

### Environment Variables

```bash
# Required
GITLAB_TOKEN=your_gitlab_token_here

# Optional
GITLAB_BASE_URL=https://gitlab.com  # Default: https://gitlab.com
```

## 📝 Usage Examples

### Example 1: Update a Single Library

1. **Frontend**: Enter project ID `123`, library `github.com/gin-gonic/gin`, version `v1.9.1`
2. **Result**: Creates branch `update-github-com-gin-gonic-gin-to-v1-9-1`
3. **Merge Request**: Automatically created with detailed description

### Example 2: Batch Update Multiple Libraries

1. **Frontend**: Click "📦 Batch Update All" for project `123`
2. **Result**: Creates separate branches and MRs for each library
3. **Tracking**: All updates tracked with individual merge requests

## 🔍 Merge Request Details

### Automatic MR Creation

Each library update creates a merge request with:

- **Descriptive Title**: `Update {library} to {version}`
- **Detailed Description**: Including changes, files modified, and diffs
- **Change Summary**: go.mod and go.sum changes
- **File List**: All modified files

### Example MR Description

```markdown
## Library Update

**Library:** github.com/gin-gonic/gin
**Version:** v1.9.1

### Changes
- Updated go.mod
- Updated go.sum

### Files Changed
go.mod, go.sum

### Go.mod Changes
```diff
- github.com/gin-gonic/gin v1.8.1
+ github.com/gin-gonic/gin v1.9.1
```

### Go.sum Changes
```diff
+ Updated checksums for new version
```
```

## 🛠️ Technical Implementation

### Backend Services

- **LibraryUpdater**: Main service for handling updates
- **Git Operations**: Clone, checkout, commit, push
- **GitLab API**: Project details, file access, MR creation
- **Go Module Management**: go get, go mod tidy

### Frontend Components

- **Update Interface**: Form for manual updates
- **Batch Operations**: Bulk update functionality
- **Results Display**: Show update results and MR links
- **Status Monitoring**: Track update progress

## 🔒 Security Considerations

### Access Control
- **Token-based Authentication**: All operations require valid GitLab token
- **Repository Access**: Token must have push access to target repositories
- **Branch Protection**: Respects GitLab branch protection rules

### Data Handling
- **Temporary Clones**: Repositories are cloned to temporary directories
- **Cleanup**: Temporary files are automatically removed
- **No Data Storage**: No sensitive data is stored permanently

## 🚨 Error Handling

### Common Issues

1. **Repository Access**: Ensure token has proper permissions
2. **Git Configuration**: Verify Git is installed and configured
3. **Network Issues**: Check connectivity to GitLab
4. **Branch Conflicts**: Handle existing branches gracefully

### Error Responses

```json
{
  "success": false,
  "error": "Failed to clone repository: access denied",
  "project_id": 123
}
```

## 📊 Monitoring and Logging

### Update Tracking
- **Success/Failure**: Track update results
- **Merge Request Links**: Direct links to created MRs
- **Change Details**: Detailed diffs of modifications

### Logging
- **Operation Logs**: All Git operations logged
- **Error Tracking**: Detailed error messages
- **Performance Metrics**: Update timing and success rates

## 🔄 Workflow Integration

### CI/CD Integration
- **Webhook Support**: Trigger updates via GitLab webhooks
- **Automated Testing**: Run tests on updated libraries
- **Deployment**: Integrate with your deployment pipeline

### Team Collaboration
- **Review Process**: All updates go through normal MR review
- **Approval Workflow**: Respect existing approval processes
- **Notification**: Team notifications for new MRs

## 🎉 Benefits

### For Developers
- **Time Saving**: Automated library updates
- **Consistency**: Standardized update process
- **Visibility**: Clear change tracking
- **Control**: Manual approval of all changes

### For Teams
- **Standardization**: Consistent update procedures
- **Documentation**: Automatic change documentation
- **Review Process**: All changes go through review
- **Rollback**: Easy rollback via Git history

## 🚀 Getting Started

1. **Configure GitLab Token**: Set up your GitLab API token
2. **Test Connection**: Verify access to your repositories
3. **Check Outdated Libraries**: Find libraries that need updates
4. **Update Libraries**: Start with single library updates
5. **Batch Updates**: Use batch operations for efficiency

The Library Update System provides a comprehensive solution for managing Go library updates in your GitLab projects, combining automation with proper review processes and detailed change tracking.
