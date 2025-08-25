# GitHub Actions CI/CD Workflow

This workflow automatically builds and deploys your `construkted.js` file to the WordPress theme repository whenever you push to the `master` or `develop` branch.

## How It Works

1. **Trigger**: Automatically runs when you push to `master` or `develop` branch
2. **Build**: Installs dependencies and runs `npm run build`
3. **Deploy**: Copies `construkted.js` to the target WordPress theme location
4. **Commit**: Automatically commits and pushes changes to the target repository

## Setup Required

### 1. Create a Deploy Key

You need to create an SSH deploy key to allow GitHub Actions to push to the target repository:

```bash
# Generate a new SSH key pair
ssh-keygen -t rsa -b 4096 -C "github-actions@yourdomain.com" -f ~/.ssh/github-actions

# The public key goes to the target repository
cat ~/.ssh/github-actions.pub
```

### 2. Add Deploy Key to Target Repository

1. Go to your target repository: `Construkted-Reality/construkted_reality_v1.x`
2. Go to **Settings** → **Deploy keys**
3. Click **Add deploy key**
4. Paste the **public key** content
5. Check **Allow write access**
6. Click **Add key**

### 3. Add Secret to Source Repository

1. Go to your source repository (this one)
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `DEPLOY_KEY`
5. Value: Paste the **private key** content (the entire file content)
6. Click **Add secret**

## Workflow Details

-   **Target Repository**: `Construkted-Reality/construkted_reality_v1.x`
-   **Target Branch**: `test-CI/CD`
-   **Target Path**: `wp-content/themes/gowatch-child/includes/construkted/assets/js/`
-   **Trigger**: Push to `main` or `master` branch
-   **Manual Trigger**: Available via GitHub Actions tab

## Manual Trigger

You can manually trigger the workflow:

1. Go to **Actions** tab in your repository
2. Select **Build and Deploy to WordPress Theme**
3. Click **Run workflow**
4. Select branch and click **Run workflow**

## What Gets Deployed

-   **File**: `construkted.js` from your build output
-   **Location**: Exact WordPress theme path structure
-   **Version**: Automatically extracted from `package.json`
-   **Commit Message**: Includes version and target path information

## Benefits

✅ **Fully Automated**: No manual deployment needed  
✅ **Version Controlled**: Each deployment is tracked with version info  
✅ **Consistent**: Same deployment process every time  
✅ **Secure**: Uses SSH keys for authentication  
✅ **Transparent**: Full logs and status in GitHub Actions

## Troubleshooting

-   **Build fails**: Check your build script and dependencies
-   **Deploy fails**: Verify deploy key is set correctly
-   **Permission denied**: Ensure deploy key has write access to target repo
-   **Branch not found**: Verify target branch exists in target repository
