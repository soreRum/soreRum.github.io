## RediShell - Kinsing Lab

Scenario: Before the ransomware deployment, the attackers established initial access through a misconfigured CI/CD server running in a Docker container within Wowza's development network. Security monitoring detected unusual outbound connections from the container subnet to a suspicious external IP address. A packet capture was initiated automatically but was terminated when the attacker discovered and killed the monitoring process. Your task is to analyze this network traffic to understand how the attackers gained their initial foothold and moved laterally within the containerized environment.

### Initial Access & Recon

misconfig-d CI/CD server running in a Docker container (Wowzas dev network) -> outbound connections from container subnet. monitoring tool detected it, attempted to capture the traffic but was blocked by James from the attacker. RIP monitoring proc

**1. Security monitoring flagged suspicious HTTP traffic targeting the container subnet. Identifying the first system that received malicious requests is essential for establishing the initial point of compromise. What is the IP address of the first compromised system?**

protocol hierarchy shows some http, a couple icmp, a good amount of telnet, some tls, this protocol called kNet which immediately showed some no nos. (185.220.101.50, 192.168.192.6, 172.16.10.20)

- container subnet: 172.16.10.0/24 -- first compro machine is 172.16.10.10
- attacker IP: 185.220.101.50
- potentially the pivot subnet outside the container: 192.168.192.0/24


**2. Identifying attacker IP is critical for threat intelligence and blocking future connections. What is the attacker's command and control (C2) IP address?**

attacker IP: 185.220.101.50

**3. What web application and version was exploited for initial access?**

looking at the http packets for initial access machine (172.16.10.10) this is how the attacker got remote access

The first set of http req shows a client using curl/8.15.0 requesting the /script endpoint (Jenkis script console) from 172.16.10.10:8080. The server responded 200 OK with an HTML page. Headers identify the service as Jenkins 2.387.1 running on Jetty 10.0.13. The returned content is the Jenkins Script Console, an administrative interface used to run arbitrary Groovy code on the Jenkins server. My guess is the attacker will comm with this /script endpoint and send it malicious Java commands to run server side. Second set of http packets shows a POST request via the curl command and its a Java command: `"println 'id'.execute().text"`. This command will execute the system command id and capture the output as a string. (id prints user info) It returned this: `text="uid=1000(jenkins) gid=1000(jenkins) groups=1000(jenkins)`. Then this command: `println 'whoami'.execute().text` returned this: `text="jenkins`


**4. Before fully exploiting a vulnerability, attackers often perform a proof-of-concept test to confirm code execution capabilities. What file did the attacker initially read to test the vulnerability? (Provide full path)**


**6. Identifying this vulnerable endpoint helps understand the attack vector and informs remediation efforts. What is the URI path of the vulnerable endpoint exploited by the attacker?**
