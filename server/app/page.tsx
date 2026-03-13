"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NumberForm() {
  const [inputValue, setInputValue] = useState('1234');
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault(); // Prevents the page from reloading

    // Check if the input is not empty before navigating
    if (inputValue !== '') {
      router.push(`/answer?code=${inputValue}`);
    }
  };

  return (
    <div className='w-full h-screen flex justify-center items-center'>    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <label htmlFor="numberInput" className="font-medium text-gray-700">
        Enter a session code:
      </label>

      <input
        id="numberInput"
        type="number"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        required
        className="border border-gray-300 p-2 rounded"
        placeholder="e.g., 1234"
      />

      <button
        type="submit"
        className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition"
      >
        Join
      </button>
    </form>
    </div>

  );
}
