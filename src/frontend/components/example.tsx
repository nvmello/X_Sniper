import React, { useState, ChangeEvent, FormEvent } from "react";

interface FormData {
  name: string;
  email: string;
  message: string;
}

const Example = () => {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    message: "",
  });
  const [status, setStatus] = useState<string>("");

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setStatus("Form submitted successfully!");
  };

  const handleReset = (): void => {
    setFormData({
      name: "",
      email: "",
      message: "",
    });
    setStatus("");
  };

  return (
    <div style={{ margin: "20px" }}>
      <h1 style={{ fontFamily: "serif", marginBottom: "20px" }}>
        User Input Form
      </h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "10px" }}>
          <label
            htmlFor="name"
            style={{ display: "inline-block", width: "60px" }}
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Enter your name"
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label
            htmlFor="email"
            style={{ display: "inline-block", width: "60px" }}
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter your email"
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label
            htmlFor="message"
            style={{ display: "inline-block", width: "60px" }}
          >
            Message
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            placeholder="Enter your message"
            rows={4}
            cols={30}
          />
        </div>

        <div style={{ marginTop: "10px" }}>
          <button type="button" onClick={handleReset}>
            Reset
          </button>
          <button
            type="button"
            onClick={() => setStatus("")}
            style={{ marginLeft: "5px", marginRight: "5px" }}
          >
            Clear Status
          </button>
          <button type="submit">Submit</button>
        </div>

        {status && <div style={{ marginTop: "10px" }}>{status}</div>}
      </form>
    </div>
  );
};

export default Example;
