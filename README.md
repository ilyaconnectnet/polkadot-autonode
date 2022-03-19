# polkadot-autonode<br />

Uses NodeJS, which interfaces with the AWS SDK, generating a keypair, then an EC2 instance.
It then executes an Ansible command that runs a playbook against that instance. 

There's a few prereqs to this.<br />
Naturally, Node and the corresponding node_modules. <br />
However, also disable strict host key checking for your Ansible user's config.<br />
Also, in AWS, for your default security group, enable SSH from your Ansible machine's IP. <br />
You also need to specify AWS credentials. These are typically in ~/.aws/credentials.<br />
Keys are generated in AWS as well.<br />
https://youtu.be/tYV0_jRhp-0<br />
https://youtu.be/Zx5colISkP4
