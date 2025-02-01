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
    <div style={{ height: "200px", overflow: "scroll" }}>
      <button>hi</button>
      <button>hi</button>
      <button>hi</button>
      <button>hi</button>
      <button>hi</button>
      <button>hi</button>
    </div>
  );
};

export default UserForm;
