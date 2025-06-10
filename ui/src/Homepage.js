import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Homepage.css";

import { useJournal } from "./context/JournalContext";

const formatDate = (dateString) => {
  if (!dateString) return "";

  // If it's a full datetime string, extract just the date part
  if (
    dateString.includes("T") ||
    (dateString.includes(" ") && dateString.includes(":"))
  ) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    }
  }

  // Handle MM/DD/YYYY format
  if (dateString.includes("/")) {
    const parts = dateString.split(" ")[0].split("/"); // Take only date part before space
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return `${day}/${month}/${year}`;
    }
  }

  return dateString.split(" ")[0]; // Fallback: return everything before first space
};

const formatTime = (dateTimeString) => {
  if (!dateTimeString) return "No time";

  try {
    // Handle various formats
    let date;

    // If it's already a Date object
    if (dateTimeString instanceof Date) {
      date = dateTimeString;
    } // If it's a string, try to parse it
    else if (typeof dateTimeString === "string") {
      // Handle MySQL datetime format (YYYY-MM-DD HH:mm:ss)
      if (dateTimeString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        date = new Date(dateTimeString.replace(" ", "T") + "Z");
      } else {
        date = new Date(dateTimeString);
      }
    }

    if (date && !isNaN(date.getTime())) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }

    return "Invalid time";
  } catch (error) {
    console.error("Error formatting time:", error, dateTimeString);
    return "Error";
  }
};

const getFirstLineWithEllipsis = (text) => {
  if (!text) return "";

  // Get first line (split by line breaks)
  const firstLine = text.split(/\r?\n/)[0].trim();

  // Check if first line contains a full stop
  const fullStopIndex = firstLine.indexOf(".");

  if (fullStopIndex !== -1) {
    // If there's a full stop, truncate at the full stop and add ellipsis
    return firstLine.substring(0, fullStopIndex + 1) + "...";
  }

  // If there are more lines or the first line is long, add ellipsis
  if (text.includes("\n") || text.includes("\r") || firstLine.length > 100) {
    return firstLine.substring(0, 100) + "...";
  }

  // Return the first line as is if it's complete and short
  return firstLine;
};

const Home = (
  { entries, onAddEntry, onUpdateEntry, onDeleteEntry, onEntriesLoad },
) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const { setSelectedEntry } = useJournal();

  // Load user info and entries on component mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (!token) {
      navigate("/login");
      return;
    }

    if (userData) {
      setUser(JSON.parse(userData));
    }

    loadEntries();
  }, [navigate]);

  const loadEntries = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const response = await fetch("http://localhost:8080/api/entries", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const entriesData = await response.json();
        if (onEntriesLoad) {
          onEntriesLoad(entriesData || []);
        }
      } else if (response.status === 401) {
        // Token expired
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
      } else {
        console.error("Failed to load entries");
      }
    } catch (error) {
      console.error("Error loading entries:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEntryClick = (entry) => {
    setSelectedEntry(entry); // Store selected entry in JournalContext
    console.log("Entry Clicked in Homepage:", JSON.stringify(entry, null, 2));

    navigate(`/analysis/${entry.id}`);
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  //Sidebar auto-collapse
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarOpen) {
        const sidebar = document.querySelector(".sidebar");
        const toggleBtn = document.querySelector(".toggle-btn");

        // If clicked outside sidebar and toggle button, close the sidebar
        if (
          !sidebar.contains(event.target) && !toggleBtn.contains(event.target)
        ) {
          setSidebarOpen(false);
        }
      }
    };

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [sidebarOpen]);

  // Logout modal auto-close
  useEffect(() => {
    if (!logoutConfirm) return;

    const handleClickOutside = (event) => {
      const modal = document.querySelector(".logout-modal-content");

      // If clicked outside modal content, close the modal
      if (modal && !modal.contains(event.target)) {
        setLogoutConfirm(false);
      }
    };

    // Add event listener on next tick to avoid interference with modal opening
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [logoutConfirm]);


  const handleDeleteEntry = async (index) => {
    const entry = filteredEntries[index]; // Use filteredEntries instead of entries

    // Ask for confirmation before deleting an entry
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${entry.title}"?`,
    );

    if (!confirmDelete) return;

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8080/api/entries/${entry.id}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        // Reload entries from server to ensure consistency
        await loadEntries();
      } else if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
      } else {
        alert("Failed to delete entry");
      }
    } catch (error) {
      console.error("Error deleting entry:", error);
      alert("Failed to delete entry. Please try again.");
    }
  };

  const handleLogoutClick = () => setLogoutConfirm(true);
  const handleCancelLogout = () => setLogoutConfirm(false);

  const handleConfirmLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    alert("Logged Out Successfully!");
    setLogoutConfirm(false);
    navigate("/login");
  };

  // Ensure entries is always an array and remove duplicates based on ID
  const uniqueEntries = React.useMemo(() => {
    if (!Array.isArray(entries)) return [];

    // Remove duplicates based on entry ID
    const seen = new Set();
    return entries.filter((entry) => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
  }, [entries]);

  // Filters entries based on search query (matching date, title, or text)
  const filteredEntries = uniqueEntries.filter((entry) =>
    entry.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.date.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="loading-container">
        <h2>Loading your journal...</h2>
      </div>
    );
  }

  return (
    <div className={`main-container ${isDarkMode ? "dark-mode" : ""}`}>
      <div className={`search-container ${searchOpen ? "open" : ""}`}>
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search journal..."
          />
          {/* Clear button - only show when there's text and search is open */}
          {searchQuery && searchOpen && (
            <button
              onClick={() => setSearchQuery("")}
              className="search-clear-btn"
              title="Clear search"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <button
          className="search-icon"
          onClick={() => setSearchOpen(!searchOpen)}
          title={searchOpen ? "Close search" : "Open search"}
        >
          🔍
        </button>
      </div>

      <aside className={`sidebar ${sidebarOpen ? "expanded" : ""}`}>
        <button className="toggle-btn" onClick={toggleSidebar}>
          {sidebarOpen ? "✖ Close" : "☰"}
        </button>
        {sidebarOpen && (
          <div className="sidebar-content">
            <h2>Dashboard</h2>
            {user && <p className="user-greeting">Hello, {user.name}! 👋</p>}
            <ul>
              <li>🔒 Privacy Settings</li>
              <li className="dark-mode-toggle">
                🌙 Dark Mode
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={isDarkMode}
                    onChange={toggleDarkMode}
                  />
                  <span className="slider"></span>
                </label>
              </li>
              <li>📜 Terms & Policy</li>
              <li onClick={handleLogoutClick} style={{ cursor: "pointer" }}>
                🚪 Logout
              </li>
            </ul>
          </div>
        )}
      </aside>

      <main className="homepage-content">
        <h2>Welcome to My Journal</h2>
        {user && <p className="welcome-text">Good to see you, {user.name}!</p>}

        <div className="entry-box">
          <Link to="/AddEntry">
            <button>Add Entry</button>
          </Link>
        </div>

        <div
          className="entries"
          style={{ maxHeight: "70vh" }}
        >
          <h3>Your Journal Entries ({uniqueEntries.length})</h3>
          {filteredEntries.length > 0
            ? (
              <div
                className="entries-list"
                style={{
                  maxHeight: "calc(70vh - 60px)",
                  paddingRight: "5px",
                }}
              >
                {filteredEntries.map((entry, index) => (
                  <div
                    key={entry.id || `entry-${index}`}
                    className="entry-item"
                    onClick={() => handleEntryClick(entry)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="entry-header">
                      <div className="entry-date-wrapper">
                        <span className="entry-date">
                          {(() => {
                            if (entry.created_at) {
                              const date = new Date(entry.created_at);
                              if (!isNaN(date.getTime())) {
                                return date.toLocaleDateString("en-US", {
                                  month: "2-digit",
                                  day: "2-digit",
                                  year: "numeric",
                                });
                              }
                            }
                            return entry.date
                              ? formatDate(entry.date)
                              : "No date";
                          })()}
                        </span>
                        <span className="entry-time">
                          {formatTime(entry.created_at)}
                        </span>
                      </div>

                      <h4 className="entry-title">{entry.title}</h4>

                      <div
                        className="entry-text"
                        style={{
                          height: "50px",
                          overflow: "hidden",
                          lineHeight: "40px",
                          marginBottom: "2px",
                        }}
                      >
                        {getFirstLineWithEllipsis(entry.text)}
                      </div>

                      <div
                        className="entry-actions"
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          marginTop: "2px",
                          width: "100%",
                        }}
                      >
                        <button
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEntry(index);
                          }}
                          title="Delete entry"
                          aria-label={`Delete entry: ${entry.title}`}
                          style={{
                            width: "900%", // Full width of container
                            maxWidth: "1500px", // Optional: limit maximum width
                            // padding: "8px 16px", // Optional: adjust padding for better appearance
                            margin: "0px 0px 10px 0px",
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
            : searchQuery
            ? (
              <div className="no-entries">
                <p>No entries found matching "{searchQuery}"</p>
              </div>
            )
            : (
              <div className="no-entries">
                <p>No entries yet. Create your first journal entry!</p>
              </div>
            )}
        </div>
      </main>

      {logoutConfirm && (
        <div className="logout-modal">
          <div className="logout-modal-content">
            <h3>Logout Confirmation</h3>
            <p>Are you sure you want to logout?</p>
            <div className="logout-modal-actions">
              <button className="yes-btn" onClick={handleConfirmLogout}>
                Yes
              </button>
              <button className="no-btn" onClick={handleCancelLogout}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Homepage = (
  { entries, onAddEntry, onUpdateEntry, onDeleteEntry, onEntriesLoad },
) => {
  return (
    <Home
      entries={entries}
      onAddEntry={onAddEntry}
      onUpdateEntry={onUpdateEntry}
      onDeleteEntry={onDeleteEntry}
      onEntriesLoad={onEntriesLoad}
    />
  );
};

export default Homepage;
