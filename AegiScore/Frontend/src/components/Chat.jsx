import React, { useState } from 'react';
import axios from 'axios';
import Heading from './Heading';  // Assuming you have a common heading component
import Section from './Section';  // Assuming you have a common section component
import Button from './Button';
import RingLoader from 'react-spinners/RingLoader';
import ReactMarkdown from 'react-markdown';
import MarkdownView from 'react-showdown';

function ChatWithLogs() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const handleDefaultMessage = () => {
    const temp = 'Analyze the processes of the system in detail and provide insights and a complete audit report about the system in markdown format. The markdown should contain the following sections: Overview, System Information, CPU Usage, Memory Usage, Suspicious Processes, Security Recommendations, Conclusions. Get information about each for each of the sections';

    setInput(temp);
    handleSubmit(temp);  // Call handleSubmit directly with the default message
  };

  const handleSubmit = async (message) => {
    const userMessage = message || input;  // Use the provided message or fallback to input state
    if (!userMessage) return;  // Do nothing if the message is empty

    const newMessage = { text: userMessage, sender: 'user' };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInput('');  // Clear input

    try {
      const response = await axios.post('http://localhost:8080/agent_query', { prompt: userMessage });
      const botMessage = { text: response.data.response, sender: 'bot' };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSubmit();  // Call handleSubmit with the current input
  };

  // Calculate height dynamically based on message count
  const chatWindowHeight = Math.min(messages.length * 50 + 100, 400); // Adjust max height as needed

  return (
    <Section id="chat">
      <div className="container mx-auto py-12">
        <Heading
          className="text-center"
          title="Chat with Logs for Insights"
        />
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg p-8 rounded-lg w-[50vw] mx-auto transition duration-300 transform hover:scale-105 hover:shadow-xl">
          {/* Chat Window */}
          <div  
            className={`chat-window mb-6 flex flex-col space-y-4 min-h-[200px] h-[500px] overflow-y-auto p-4 bg-gray-700 rounded-md`}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={`p-6 rounded-lg ${message.sender === 'user' ? 'bg-blue-600 self-start' : 'bg-purple-600 self-end'} text-white max-w-[500px] h-max`}
              >
                {/* <ReactMarkdown>{message.text}</ReactMarkdown> */}
                <MarkdownView markdown={message.text} options={{tables:true,emoji:true}} className='agent_result'/>
              </div>
            ))}
            
            {messages.length > 0  && messages.at(-1).sender !== 'bot' && <div className='self-end'>
                <RingLoader
                  color={'#c59de0'}
                  size={60}
                />
              </div>}
          </div>

          {/* Button to send default message */}
          <Button
            onClick={handleDefaultMessage}
            className="w-full py-3 bg-gradient-to-r transition duration-300 mb-6"
          >
            Create Accurate Audit Reports
          </Button>

          {/* Form for typing and sending messages */}
          <form onSubmit={handleFormSubmit} className="space-y-6">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="w-full px-4 py-2 border border-gray-500 rounded-md bg-gray-700 text-white transition duration-300 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              type="submit"
              className="w-full py-3 bg-gradient-to-r  transition duration-300"
            >
              Send Message
            </Button>
          </form>
        </div>

        {/* Adding styles directly within the component */}
        <style jsx>{`
          @keyframes outer-light {
            0% {
              box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
            }
            50% {
              box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
            }
            100% {
              box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
            }
          }

          .hover\:outer-light:hover {
            animation: outer-light 1s infinite alternate;
          }
        `}</style>
      </div>
    </Section>
  );
}

export default ChatWithLogs;
