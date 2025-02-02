import React, { useState, ChangeEvent, FormEvent } from "react";

interface TxData {
  contractAddress: string;
  amount: number;
  tip: number;
  slippage: number;
}

const UserForm = () => {
  //manages the state of the following input boxes
  const [txData, setTxData] = useState<TxData>({
    contractAddress: "",
    amount: 0,
    tip: 0,
    slippage: 0,
  });

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-2xl font-bold text-blue-600 mb-4">
          Hello, Tailwind CSS!
        </h1>
        <p className="text-gray-700">
          This is a simple example of Tailwind CSS in action.
        </p>
        <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300">
          Click Me
        </button>
      </div>
    </div>
  );
};

export default UserForm;
