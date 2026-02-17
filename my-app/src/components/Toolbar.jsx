import React from "react";

export default function Toolbar({ username }) {
  return (
    <header className="d-flex justify-content-between align-items-center px-3 py-2 bg-dark text-white">
      {/* Left side */}
      <div className="d-flex align-items-center">
        <h1 className="h5 mb-0 me-3">Collaborative IDE</h1>
        <span className=" small">Demo Project</span>
      </div>

      {/* Right side */}
      <div className="d-flex align-items-center">
        <button className="btn btn-primary btn-sm me-2">Run</button>
        <button className="btn btn-outline-light btn-sm me-3">Share</button>
        <span className="small">{username}</span>
      </div>
    </header>
  );
}
