// Load the SDK and UUID
const AWS = require('aws-sdk')
const uuid = require('uuid');

// We use this to run Ansible via Node
const { exec } = require('child_process');
const fs = require('fs')

// Instantiate input
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})

const main = async () => {

    // https://stackoverflow.com/questions/46907761/node-js-promisify-readline
    function question(query) {
        return new Promise(resolve => {
            readline.question(query, resolve);
        })
    }

    // Ensures credentials are accessible
    AWS.config.getCredentials(function (err) {
        if (err) console.log(err.stack);
        // credentials not loaded
        else {
            console.log("Access key:", AWS.config.credentials.accessKeyId);
        }
    });

    // Asks for a name for the node
    let nodeName = await question('What is the name of the node? (Leave empty for auto-gen)');
    // If the name is falsy, we use an auto-generated uuid. 
    if (!nodeName) nodeName = 'node-' + uuid.v4();

    // Asks for the region
    // https://i.imgur.com/8ZcmBBp.png
    let region = await question('What region do you want to place it? (Leave empty for ap-southeast-2)');
    // If the region is falsy, we use an opinionated ap-southeast-2 (Sydney). 
    if (!region) region = 'ap-southeast-2';

    // Asks for the image ID
    let amiId = await question('What AMI do you want to use? (Leave empty for ami-0b7dcd6e6fd797935)');
    // If the AMI is falsy, we use the latest Amazon one. 
    if (!amiId) amiId = 'ami-0b7dcd6e6fd797935';


    // Create EC2 service object
    const ec2 = new AWS.EC2({ apiVersion: '2016-11-15', region: region });

    // Create Params for KeyName to Use
    let instanceParams = {
        KeyName: nodeName
    }


    // Create the key pair
    await ec2.createKeyPair(instanceParams, async function (err, data) {
        if (err) {
            console.log("Error", err);
        } else {

            const privKey = data.KeyMaterial

            fs.writeFile(`keys/${nodeName}.pem`, privKey, (err) => {
                if (err)
                    console.log(err);
                else {
                    console.log("File written successfully\n");

                    // Set permissions on the key. 

                    console.log("Setting permissions on the key.")
                    exec(`chmod 400 keys/${nodeName}.pem`, (err, stdout, stderr) => {
                        if (err) {
                            console.error(`exec error: ${err}`);
                            return;
                        }
                    });



                }
            });
        }
    });

    // We do this seperately to instation to avoid createKeyPair issues. 
    instanceParams.ImageId = amiId
    instanceParams.InstanceType = 't2.micro'
    instanceParams.MinCount = 1
    instanceParams.MaxCount = 1


    // Create a promise on an EC2 service object
    const instancePromise = new AWS.EC2({ apiVersion: '2016-11-15', region: region }).runInstances(instanceParams).promise();

    let instanceIp, instanceId

    // Handle promise's fulfilled/rejected states
    await instancePromise.then(
        function (data) {

            instanceId = data.Instances[0].InstanceId;

            console.log("Created instance", instanceId);
            // Add tags to the instance
            tagParams = {
                Resources: [instanceId], Tags: [
                    {
                        Key: 'Name',
                        Value: nodeName
                    }
                ]
            };
            // Create a promise on an EC2 service object
            const tagPromise = new AWS.EC2({ apiVersion: '2016-11-15', region: region }).createTags(tagParams).promise();
            // Handle promise's fulfilled/rejected states
            tagPromise.then(
                function (data) {
                    console.log("Instance tagged");
                }).catch(
                    function (err) {
                        console.error(err, err.stack);
                    });
        }).catch(
            function (err) {
                console.error(err, err.stack);
            });


    console.log(instanceId)

    //Filter for findIp
    const params = {
        Filters: [
            {
                Name: 'instance-id',
                Values: [
                    instanceId
                ]
            },
        ],
    };


    //We wait for our node to be assigned a public IP.     
    const findIp = async function () {
        return await new Promise(resolve => {
            const interval = setInterval(async () => {
                await ec2.describeInstances(params, function (err, data) {
                    instanceIp = data.Reservations[0].Instances[0].PublicIpAddress
                    console.log(instanceIp)
                    if (instanceIp.indexOf(".") >= 0) {
                        console.log("Fetched IP!")
                        resolve('foo');
                        clearInterval(interval);
                    }
                })

            }, 1000)
        })
    }
    await findIp();

    // The servers are typically inaccessible for a bit - Time constraints with this project lead me to go this route. 
    console.log("Waiting for server to go live...")
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    await delay(30000) /// waiting 15 second.

    // Builds the Ansible command
    const command = `ansible-playbook -i ${instanceIp}, --private-key keys/${nodeName}.pem -e "nodeName=${nodeName}" playbooks/install-polkadot.yml`
    console.log(command)

    console.log("Executing command - This will take a while.")

    // Ansible does not know when the Polkadot node image finishes installing. 
    exec(command, (err, stdout, stderr) => {
        if (err) {
            console.log(stderr)
            return;
        }
        console.log(stdout)
    });
}

main()