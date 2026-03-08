### Poisoned PyTorch Lab

Goal: `Investigate a software supply-chain compromise that escalates into a ransomware attack, with emphasis on identifying pre-encryption operations.`

Scenario: `On 2 February 2026 (UTC), a developer at unucorb executed a model training script from Visual Studio Code on PC01 as part of an internal AI/ML project. Unbeknownst to the user, a trusted third-party Python dependency within the project had been tampered with, resulting in silent code execution and the establishment of remote access on the workstation. Your objective is to analyze the provided SIEM telemetry and host-based artifacts to reconstruct the end-to-end intrusion timeline, determine how initial access was achieved, track attacker activity across the domain, and identify pre-encryption behavior and ransomware impact used to maximize damage.`

Just notes....

Initial Access
--------------

Initial access was achieved via a software supply-chain compromise involving the Python dependency PyTorch (torch). The torch package is a trusted third-party machine learning library that had been tampered with to include a malicious backdoor in this scenario. When the developer executed the model training script from Visual Studio Code on PC01, the Python interpreter imported the torch module as part of the application runtime. Because the installed version of the dependency had been compromised, malicious code embedded within the package executed automatically during the import process. The malicious code spawned a hidden PowerShell process which downloaded and executed a second-stage payload from the attacker-controlled host: **http://<54.93.78.216>/a**
This established remote access to the workstation, initiating the attacker’s foothold in the environment. This attack is effective because developers inherently trust widely used dependencies, and importing a module in Python executes package initialization code automatically. As a result, malicious code embedded in a dependency can run without any additional user interaction beyond executing the application.

Execution
---------

The origin of this instrusion came from a script the developer ran in his AI/ML project directory, `C:\Users\michelvic\torch-inference-stack\training\train.py`.
At 2026-02-02 01:17:01, torch lib already imported meaning the malicious PS command from above executed on PC01. Pivoting to outbound comms (Event ID 3 -- Sysmon Logs) from PC01 following the PS download, michelvic (worksation) contacted <54.93.78.216:80> to grab the first stage payload. This was at 2/2/2026 1:17:06 AM which coorelates with the powershell command execution seconds before. The IP was also visible above from the Sysmon Event ID 1 log too. 

Discovery
--------

