import os
from openai import OpenAI

try:
    client = OpenAI(
        base_url='https://ark.ap-southeast.bytepluses.com/api/v3',
        api_key='VxCgNvLTE.ChthcGlrZXktMjAyNjA5MjYyMjIwMzAtc3BxZjUQ-5_rmAsYAiChsbAtKhCfbVs3Y4ZNyaYEA0mgOVlR.5vf7PVVe5D3Q4mSB792sHun4PKv2KfynDAPmirc9K8MRLfh0VPFzQp84yny1A7t9brxZLjpO-FDR-TqCaS3o5QeZ',
    )
    print("OpenAI client initialized")
    print("Has responses attribute?", hasattr(client, 'responses'))
    if hasattr(client, 'responses'):
        print("Dir responses:", dir(client.responses))
except Exception as e:
    print("ERROR:", e)
