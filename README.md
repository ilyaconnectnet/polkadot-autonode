# polkadot-autonode
There's a few prereqs to this.
Naturally, Node and the corresponding node_modules. 
However, also disable strict host key checking for your Ansible user's config.
Also, in AWS, for your default security group, enable SSH from your Ansible machine's IP. 
Keys are generated in AWS as well.
