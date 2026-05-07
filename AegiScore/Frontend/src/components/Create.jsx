import React, { useState } from 'react';
import axios from 'axios';
import Heading from './Heading'; // Assuming you have a common heading component
import Section from './Section'; // Assuming you have a common section component
import Button from './Button';   // Assuming you have a common button component

function CreateLogs() {
  const [maxCount, setMaxCount] = useState('');
  const [timeInterval, setTimeInterval] = useState('');
  const [logs, setLogs] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:8080/create_logs', {
        max_count: maxCount,
        time_interval: timeInterval
      });
      setLogs(response.data.data);
    } catch (error) {
      console.error('Error creating logs:', error);
    }
  };

  return (
    <Section id="create">
      <div className="container mx-auto py-12 items-center justify-center">
        <Heading className="text-center" title="Create Logs" />
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg p-8 rounded-lg mx-auto transition duration-300 transform hover:scale-105 hover:shadow-xl hover:outer-light w-[50vw]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col">
              <label htmlFor="maxCount" className="mb-2 text-lg font-semibold">
                Max Count:
              </label>
              <input
                id="maxCount"
                type="number"
                value={maxCount}
                onChange={(e) => setMaxCount(e.target.value)}
                placeholder="Enter max count"
                className="px-4 py-2 border rounded-md bg-gray-700 text-white transition duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="timeInterval" className="mb-2 text-lg font-semibold">
                Time Interval (ms):
              </label>
              <input
                id="timeInterval"
                type="number"
                value={timeInterval}
                onChange={(e) => setTimeInterval(e.target.value)}
                placeholder="Enter time interval"
                className="px-4 py-2 border rounded-md bg-gray-700 text-white transition duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button
              type="submit"
              className="w-full py-3 bg-gradient-to-r transition duration-300"
            >
              Create Logs
            </Button>
          </form>
          {logs && (
            <div className="mt-6 h-[500px] overflow-y-scroll overflow-x-hidden">
              <h3 className="text-lg font-semibold">Generated Logs:</h3>
              <pre className="bg-gray-600 p-4 rounded-md overflow-auto">{logs}</pre>
            </div>
          )}
        </div>
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
    </Section>
  );
}

export default CreateLogs;
