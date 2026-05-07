import os
from dotenv import load_dotenv
from llama_index.llms.gemini import Gemini
from llama_index.core.agent import ReActAgent
from llama_index.core.tools import FunctionTool

load_dotenv(dotenv_path='Server/.env')
api_key = os.getenv('GOOGLE_API_KEY')

llm = Gemini(model='models/gemini-flash-latest', api_key=api_key)

def test_tool(input: str) -> str:
    return f"Tool received: {input}"

tool = FunctionTool.from_defaults(fn=test_tool, name="test_tool", description="A test tool")

agent = ReActAgent.from_tools(tools=[tool], llm=llm, verbose=True)

try:
    response = agent.query("Use the test tool with 'hello'")
    print("Response:", response)
except Exception as e:
    print("Error:", e)
