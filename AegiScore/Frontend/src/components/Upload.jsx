import React, { useState } from 'react';
import axios from 'axios';
import Heading from './Heading';
import Section from './Section';
import Button from './Button';

function FileUpload() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8080/file_save', formData);
      setMessage(response.data.status);
    } catch (error) {
      setMessage('Error uploading file');
    }
  };

  return (
    <Section id="upload">
      <div className="container mx-auto py-12">
        <Heading
          className="text-center"
          title="Upload Your Files Securely"
        />
        <div className="shadow-lg p-10 rounded-lg max-w-xl mx-auto bg-gradient-to-r from-gray-900 to-gray-800 text-white transform transition duration-300 hover:scale-105 hover:shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col">
              <label htmlFor="file-upload" className="mb-2 text-lg font-semibold">
                Choose File:
              </label>
              <input
                type="file"
                id="file-upload"
                onChange={handleFileChange}
                className="px-4 py-2 border border-gray-500 rounded-md bg-gray-700 text-white transition duration-300 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Button
              type="submit"
              className="w-full py-3 bg-gradient-to-r transition duration-300"
            >
              Upload File
            </Button>
          </form>

          {/* Display message after file upload */}
          {message && (
            <p className={`mt-4 text-center text-lg font-semibold ${message.includes('Error') ? 'text-red-500' : 'text-green-500'} transition duration-300`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}

export default FileUpload;
