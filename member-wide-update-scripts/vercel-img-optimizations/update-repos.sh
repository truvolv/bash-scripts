#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(pwd)"
LOG_FILE="$SCRIPT_DIR/logs.csv"
ERROR_FILE="$SCRIPT_DIR/error.csv"
PR_LINKS_FILE="$SCRIPT_DIR/pr-links.txt"
LOG_TRACKING_FILE="$SCRIPT_DIR/logs.txt"
MANUAL_UPDATE_FILE="$SCRIPT_DIR/manual-updates.csv"

BATCH_SIZE=${1:-5}
echo -e "${YELLOW}Batch size set to: $BATCH_SIZE apps${NC}"

echo "Repo,App,Status,Notes,PR Link" > "$LOG_FILE"
echo "Repo,Issue,Details" > "$ERROR_FILE"
echo "Repo,App,Status,Notes" > "$MANUAL_UPDATE_FILE"
echo -e "${GREEN}Created new logs.csv, error.csv, and manual-updates.csv files${NC}"

apps_fixed=0

# Start timestamp for logs tracking file, create if not exists
if [[ ! -f "$LOG_TRACKING_FILE" ]]; then
    echo "Mass repo update started at $(date)" > "$LOG_TRACKING_FILE"
    echo "================================================" >> "$LOG_TRACKING_FILE"
else
    # If file exists, append to it with a new header
    echo "" >> "$LOG_TRACKING_FILE"
    echo "Mass repo update started at $(date)" >> "$LOG_TRACKING_FILE"
    echo "================================================" >> "$LOG_TRACKING_FILE"
fi

# Check if repo list file exists
REPO_LIST_FILE="repo-list.txt"
if [[ ! -f "$REPO_LIST_FILE" ]]; then
    echo -e "${RED}Error: $REPO_LIST_FILE not found!${NC}"
    echo "Please create a file called 'repo-list.txt' with one repository name per line."
    echo "Example format:"
    echo "  my-org/repo1"
    echo "  my-org/repo2"
    exit 1
fi

# Create all-repos directory if it doesn't exist
mkdir -p all-repos

# Read repos from file
while IFS= read -r repo_name || [[ -n "$repo_name" ]]; do
    # Skip empty lines and comments
    [[ -z "$repo_name" || "$repo_name" =~ ^[[:space:]]*# ]] && continue

    if [[ $apps_fixed -ge $BATCH_SIZE ]]; then
        echo -e "${GREEN}Batch limit of $BATCH_SIZE apps reached. Stopping.${NC}"
        break
    fi
    
    echo -e "${YELLOW}Processing: $repo_name (Fixed: $apps_fixed/$BATCH_SIZE)${NC}"
    
    repo_dir="all-repos/$(basename "$repo_name")"
    
    # Step 2: Clone repo if not present
    if [[ ! -d "$repo_dir" ]]; then
        echo "Cloning $repo_name..."
        if ! gh repo clone "$repo_name" "$repo_dir"; then
            echo -e "${RED}  Failed to clone $repo_name${NC}"
            echo "\"$repo_name\",\"clone-failed\",\"Could not clone repository\"" >> "$ERROR_FILE"
            continue
        fi
    fi
    
    # Step 3: CD into repo, checkout main, and pull
    cd "$repo_dir" || {
        echo -e "${RED}  Failed to cd into $repo_dir${NC}"
        echo "\"$repo_name\",\"access-failed\",\"Could not access repository directory\"" >> "$ERROR_FILE"
        cd - > /dev/null
        continue
    }
    
    # Checkout main and pull
    if ! git checkout main 2>/dev/null && ! git checkout master 2>/dev/null; then
        echo -e "${RED}  Failed to checkout main/master branch${NC}"
        echo "\"$repo_name\",\"checkout-failed\",\"Could not checkout main or master branch\"" >> "$ERROR_FILE"
        cd - > /dev/null
        continue
    fi
    
    if ! git pull; then
        echo -e "${RED}  Failed to pull latest changes${NC}"
        echo "\"$repo_name\",\"pull-failed\",\"Could not pull latest changes\"" >> "$ERROR_FILE"
        cd - > /dev/null
        continue
    fi
    
    # Check if turbo.json file exists
    if [[ ! -f "turbo.json" ]]; then
        echo -e "${YELLOW}  Skipped - Not a turbo repo${NC}"
        echo "\"$repo_name\",\"skipped\",\"Not a turbo repository (no turbo.json found)\"" >> "$ERROR_FILE"
        cd - > /dev/null
        continue
    fi
    
    echo "  Found turbo repo, processing apps..."
    
    # Step 4: Check if apps/ directory exists
    if [[ ! -d "apps" ]]; then
        echo -e "${YELLOW}  Skipped - No apps/ directory${NC}"
        echo "\"$repo_name\",\"skipped\",\"No apps/ directory found\"" >> "$ERROR_FILE"
        cd - > /dev/null
        continue
    fi
    
    changes_made=false
    pr_url=""
    
    # Step 4-7: Iterate over subdirectories in apps/
    for app_dir in apps/*; do
        [[ ! -d "$app_dir" ]] && continue

        if [[ $apps_fixed -ge $BATCH_SIZE ]]; then
            echo -e "${GREEN}Batch limit of $BATCH_SIZE apps reached. Stopping.${NC}"
            break
        fi
    
        
        app_name=$(basename "$app_dir")
        echo "    Processing app: $app_name"
        echo "    App Directory: $app_dir"

        needs_manual_update=false

        next_config_updated=false
        next_config_already_updated=false

        # Check if next.config.mjs is already updated
        if [[ -f "$app_dir/next.config.mjs" ]]; then
            if grep -q "createNextConfig" "$app_dir/next.config.mjs"; then
                next_config_already_updated=true
            fi
        fi

        if [[ "$next_config_already_updated" == true ]]; then
            echo "\"$repo_name\",\"$app_name\",\"completed\",\"already updated (not counted toward batch)\",\"\"" >> "$LOG_FILE"
            echo "      next.config.mjs already uses createNextConfig, skipping..."
            continue
        fi
        
        # Update next.config.mjs if it matches the standard old pattern (safe to auto-overwrite)
        if [[ -f "$app_dir/next.config.mjs" ]]; then
            if grep -q "from '@truvolv/orson-seelib/next.rewrites.mjs'" "$app_dir/next.config.mjs" && \
               grep -q "from '@truvolv/orson-seelib/next.redirects.mjs'" "$app_dir/next.config.mjs" && \
               grep -q "const nextConfig" "$app_dir/next.config.mjs" && \
               grep -q "const cmsUrl" "$app_dir/next.config.mjs"; then
                echo "      Updating next.config.mjs in $app_name"
                cat > "$app_dir/next.config.mjs" << 'EOF'
/** @type {import('next').NextConfig} */

import { rewrites } from '@truvolv/orson-seelib/next.rewrites.mjs';
import { redirects } from '@truvolv/orson-seelib/next.redirects.mjs';
import { createNextConfig } from '@truvolv/orson-seelib/createNextConfig.mjs';

export default createNextConfig({
  transpilePackages: ["@truvolv/orson-seelib"],
  rewrites,
  redirects
});
EOF
                next_config_updated=true
                changes_made=true
            else
                echo "      Skipping next.config.mjs in $app_name - custom member edits detected"
                echo "\"$repo_name\",\"$app_name\",\"manual-update-required\",\"Custom member edits in next.config.mjs\"" >> "$MANUAL_UPDATE_FILE"
                needs_manual_update=true
            fi
        else
            echo "      No next.config.mjs found in $app_name, skipping..."
            echo "\"$repo_name\",\"$app_name\",\"skipped\",\"No next.config.mjs found\",\"\"" >> "$LOG_FILE"
            continue
        fi

        # Determine final status and notes
        notes=""
        if [[ "$next_config_updated" == true ]]; then
            notes="next.config.mjs updated to use createNextConfig"
            status="success"
        else
            notes="next.config.mjs not updated"
            status="partial"
        fi

        if [[ "$needs_manual_update" == true ]]; then
            echo "\"$repo_name\",\"$app_name\",\"$status, needs manual update\",\"$notes\",\"\"" >> "$LOG_FILE"
        else
            echo "\"$repo_name\",\"$app_name\",\"$status\",\"$notes\",\"\"" >> "$LOG_FILE"
        fi

        # Count toward batch only if the update was successfully applied
        if [[ "$next_config_updated" == true ]]; then
            ((apps_fixed++))
            echo "APP STATUS: $repo_name/$app_name - $status - $notes" >> "$LOG_TRACKING_FILE"
            echo "    App fixed! Total fixed: $apps_fixed"
        fi
    done
    
    # Start timestamp for PR links file, create if not exists
    if [[ ! -f "$PR_LINKS_FILE" ]]; then
        echo "PR Links from mass repo update started at $(date)" > "$PR_LINKS_FILE"
        echo "================================================" >> "$PR_LINKS_FILE"
    else
        # If file exists, append to it with a new header
        echo "" >> "$PR_LINKS_FILE"
        echo "PR Links from mass repo update started at $(date)" >> "$PR_LINKS_FILE"
        echo "================================================" >> "$PR_LINKS_FILE"
    fi

    #‼️ TODO: edit this based on testing needs when script is created
    # Step 7-8: Create branch, commit, push, and create PR if changes were made, optionally push straight to main if you are confident in the changes and want to skip PR creation.
    # example below includes PR creation steps commented out, you can uncomment them and comment out the direct push to main once you're ready to test PR creation.
    if [[ "$changes_made" == true ]]; then
        # Comment out lines for Step #7-8 once tested and ready to push to main
        # branch_name="[add_your_branch_name_here]" #‼️TODO: update branch name as needed
        
        # echo "  Cleaning up git references..."
        # git fetch --prune origin 2>/dev/null || true
        
        # echo "  Creating branch: $branch_name"
        # if ! git checkout -b "$branch_name" 2>/dev/null; then
        #     echo -e "${YELLOW}  Branch creation failed (likely already exists), discarding local changes${NC}"
        #     echo "\"$repo_name\",\"branch-exists\",\"Branch creation failed, likely already exists - local changes discarded\"" >> "$ERROR_FILE"
            
        #     # Reset any local changes
        #     git reset --hard HEAD
        #     git clean -fd
            
        #     cd - > /dev/null
        #     continue
        # fi
        
        echo "  Committing changes..."
        git add .
        if ! git commit -m "Migrate next.config.mjs to use createNextConfig from orson-seelib"; then
            echo -e "${RED}  Failed to commit changes${NC}"
            echo "\"$repo_name\",\"commit-failed\",\"Could not commit changes\"" >> "$ERROR_FILE"
            cd - > /dev/null
            continue
        fi
        
        echo "  Pushing branch..."
        # Uncomment next line once tested to push without PR creation
        # if ! git push origin "$branch_name"; then
        if ! git push; then

            echo -e "${RED}  Failed to push branch${NC}"
            echo "\"$repo_name\",\"push-failed\",\"Could not push branch $branch_name\"" >> "$ERROR_FILE"
            cd - > /dev/null
            continue
        fi
        
        #‼️TODO: optionally update here for testing in PRs!
        # echo "  Creating PR..."
        # pr_url=$(gh pr create \
        #     --title "Update API route and core events page" \
        #     --body "This PR updates:

        #     - API route to include all handlers from orson-seelib
        #     - Events page to display separate events page using CoreEvent component from orson-seelib

        #     Ticket: https://truvolv-company.monday.com/item/TRUSPD-583

        #     This is an automated update across multiple repositories." \
        #     --head "$branch_name" 2>&1)

        # if [[ $? -eq 0 ]]; then
        #     echo -e "${GREEN}  ✓ PR created successfully${NC}"
            
        #     # Add to PR links file
        #     echo "$repo_name: $pr_url" >> "$PR_LINKS_FILE"
            
        #     # Update the CSV with PR URL for successful app updates
        #     temp_file=$(mktemp)
        #     while IFS= read -r line; do
        #         if [[ "$line" == *"\"$repo_name\","*"\",\"success\","* ]]; then
        #             # Replace the empty PR link with the actual URL
        #             echo "${line%,\"\"*},\"$pr_url\"" >> "$temp_file"
        #         else
        #             echo "$line" >> "$temp_file"
        #         fi
        #     done < "$LOG_FILE"
        #     mv "$temp_file" "$LOG_FILE"
        # else
        #     echo -e "${RED}  Failed to create PR${NC}"
        #     echo "\"$repo_name\",\"pr-failed\",\"Could not create pull request\"" >> "$ERROR_FILE"
        # fi
    else
        echo -e "${YELLOW}  No changes needed${NC}"
        echo "\"$repo_name\",\"no-changes\",\"Repository processed but no changes were needed\"" >> "$ERROR_FILE"
    fi
    
    cd - > /dev/null
    echo ""
    
done < "$REPO_LIST_FILE"

# End timestamp for PR links file
echo "================================================" >> "$PR_LINKS_FILE"
echo "Mass repo update completed at $(date)" >> "$PR_LINKS_FILE"

# End timestamp for logs tracking file
echo "================================================" >> "$LOG_TRACKING_FILE"
echo "Mass repo update completed at $(date)" >> "$LOG_TRACKING_FILE"

echo -e "${GREEN}Batch processing completed! Fixed $apps_fixed apps out of target $BATCH_SIZE.${NC}"
echo -e "${GREEN}Check logs.csv for app-level status and error.csv for repo-level issues.${NC}"
echo -e "${GREEN}PR links saved to: $PR_LINKS_FILE${NC}"
echo -e "${GREEN}Detailed logs saved to: $LOG_TRACKING_FILE${NC}"