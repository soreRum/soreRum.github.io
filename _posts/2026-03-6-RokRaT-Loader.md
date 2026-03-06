### Malware: APT 37’s RokRaT Loader Analysis
**Capability:** RokRaT Loader (Stage 1)

**Tradecraft:**

API Resolution via Hashing…dynamically…at runtime…yea…itll call this API func via a function pointer. When I opened this loader in PE Studio and looked at the import section I only saw two API funcs: WSAStartup and LoadLibrary. I assumed the loader might be resolving its APIs at runtime, but needed to confirm that in a disass. 

Understanding this process -> The hashes are pre-made before adding them into the loader code, using a custom or known hashing algorithm (like ones from HashDB).
Hashing process looks like this: Hashing code → hashes the APIs the loader will need → produces hashed values → those hashes get plugged into the loader code. At runtime, the loader will contain a function that browses the list of loaded modules in memory. It is able to browse loaded modules (DLLs) because when the malware loader starts and the Windows loader takes over, it automatically maps some base subsystem DLLs and ntdll.dll into the process memory by default. Because of this, even if the malware has no direct API imports in the IAT, there are still DLLs already loaded in memory that it can work with. The malware loader function will then loop through each loaded DLL, and for each one it will browse through the list of exported functions in that DLL’s Export Address Table (EAT). For each exported function it encounters:
- It grabs the function name
- Hashes the name using the same hashing algorithm
- Compares that hash to the pre-made hashes scattered throughout the loader code

If the hash computed from the DLL’s EAT matches one of the pre-made hashes, the loader now knows the memory address of that function.  It can then store that address (usually as a function pointer) and call the function when needed.

Now I will pivot to the code side to re-create at a very basic level the API Hashing operation 


Next I will pivot to building a mental model of how certain code blocks during the API hashing process look in Assembly


