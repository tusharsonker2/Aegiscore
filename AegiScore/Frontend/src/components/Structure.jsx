import React, { useState } from 'react';
import axios from 'axios';
import Heading from './Heading'; // Assuming you have a common heading component
import Section from './Section'; // Assuming you have a common section component
import Button from './Button';   // Assuming you have a common button component

function CreateLogs() {
  const [data, setData] = useState('');
  const [filename, setFilename] = useState('');
  const [logs, setLogs] = useState('');
  const [resFile, setResFile] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:8080/converttocsv', {
        filename: filename,
        data: data,
      });
      setLogs(response.data.data);
      setResFile(response.data.filename)
    } catch (error) {
      console.error('Error creating logs:', error);
    }
  };

  return (
    <Section id="create">
      <div className="container mx-auto py-12 items-center justify-center">
        <Heading className="text-center" title="Structure Data" />
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg p-8 rounded-lg mx-auto transition duration-300 transform hover:scale-105 hover:shadow-xl hover:outer-light w-[50vw]">
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col">
              <label htmlFor="Data" className="mb-2 text-lg font-semibold">
                Give new filename for Structured Data : 
              </label>
              <input
                id="File Name"
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Eg: abc.csv"
                className="px-4 py-2 border rounded-md bg-gray-700 text-white transition duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="Data" className="mb-2 text-lg font-semibold">
                Data:
              </label>
              <input
                id="data"
                type="text"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="Enter the Data"
                className="px-4 py-2 border rounded-md bg-gray-700 text-white transition duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button
              type="submit"
              className="w-full py-3 bg-gradient-to-r transition duration-300"
            >
              Struture It
            </Button>
          </form>
          {logs && (
            <div className="mt-6 h-[500px] overflow-y-scroll overflow-x-hidden">
              <h3 className="text-lg font-semibold">File: {resFile}</h3>
              <h3 className="text-lg font-semibold">Structure Data</h3>
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
