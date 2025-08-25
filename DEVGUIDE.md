### branch naming
issue{issue number}-{keyword list} for example, issue166-ar-exit-bug.
If any problem is found in the branch which was already merged to the master,
create new branch, for example issue166-1-ar-exit-bug and works on it. 

### synchronizing with construkted_reality repo
- If the construkted_reality branch does n't need js changes, then we do NOT create new js branch.
- Every js branch should have a corresponding construkted_reality branch.

### before push for each branch
- update change log
- update config.version 

### squash commits of branch
- 1 checkout to the master and pull   
    git checkout master && git pull origin master 

- 2 create template branch  
    git checkout -b <branch_name>-tmp
    
- 3 merge temp branch with original branch 
   git merge --squash <branch_name>

- 4 revise commit message 
   git commit -am "<Message describing all squashed commits>" 

- 5 rename original branch 
   git branch -m <branch_name> <branch_name>_unsquashed 

- 6 rename temp branch with original branch name 
  git branch -m <branch_name> 

- 7 push 
 git push origin <branch_name>  --force

