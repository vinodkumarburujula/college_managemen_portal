
// ---------------------------
// LocalStorage Helpers
// ---------------------------
const LS = {
  read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

// Ensure core buckets exist
(function bootstrapStorage(){
  if (!LS.read("users", null)) LS.write("users", []);
  if (!LS.read("jobs", null)) LS.write("jobs", []);
  if (!LS.read("applications", null)) LS.write("applications", []);
  if (!LS.read("messages", null)) LS.write("messages", []);
})();

// Auth helpers
function getLoggedInUser() {
  return LS.read("loggedInUser", null);
}
function requireRole(role) {
  const u = getLoggedInUser();
  if (!u || (role && u.role !== role)) {
    alert("Please login with a valid account to access this page.");
    window.location.href = "login.html";
  }
}

// ---------------------------
// Registration
// ---------------------------
function onRegisterSubmit(e){
  e.preventDefault();
  const username = document.getElementById("reg_username").value.trim();
  const password = document.getElementById("reg_password").value.trim();
  const mobile   = document.getElementById("reg_mobile").value.trim();
  const role     = document.getElementById("reg_role").value; // 'officer' or 'student'

  if(!username || !password || !mobile){
    alert("All fields are required.");
    return;
  }

  const users = LS.read("users", []);
  if (users.some(u => u.username === username)) {
    alert("Username already exists.");
    return;
  }
  users.push({ username, password, mobile, role });
  LS.write("users", users);
  alert("Registration successful. You can now login.");
  window.location.href = "login.html";
}

function mountRegister(){
  const form = document.getElementById("registerForm");
  if(form) form.addEventListener("submit", onRegisterSubmit);
}

// ---------------------------
// Login
// ---------------------------
function onLoginSubmit(e){
  e.preventDefault();
  const username = document.getElementById("login_username").value.trim();
  const password = document.getElementById("login_password").value.trim();

  const users = LS.read("users", []);
  const user = users.find(u => u.username === username && u.password === password);
  if(!user){
    alert("Invalid credentials");
    return;
  }
  LS.write("loggedInUser", user);
  if(user.role === "officer") window.location.href = "officer_dashboard.html";
  else window.location.href = "student_dashboard.html";
}

function mountLogin(){
  const form = document.getElementById("loginForm");
  if(form) form.addEventListener("submit", onLoginSubmit);
}

// ---------------------------
// Logout
// ---------------------------
function doLogout(){
  localStorage.removeItem("loggedInUser");
  window.location.href = "index.html";
}

// ---------------------------
// Officer: Post Job
// ---------------------------
function mountJobPost(){
  const jobPostForm = document.getElementById("jobPostForm");
  if(!jobPostForm) return;

  requireRole("officer");

  jobPostForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("title").value.trim();
    const company = document.getElementById("company").value.trim();
    const location = document.getElementById("location").value.trim();
    const deadline = document.getElementById("deadline").value;
    const description = document.getElementById("description").value.trim();
    const packageVal = document.getElementById("package").value.trim();

    const loggedInUser = getLoggedInUser();
    if(!loggedInUser){
      alert("You must be logged in to post a job!");
      return;
    }
    if(!title || !company || !location || !deadline || !description){
      alert("Please fill all required fields.");
      return;
    }

    const jobs = LS.read("jobs", []); // fixed key: 'jobs' consistently
    const job = {
      id: Date.now(),
      title, company, location, deadline, description,
      package: packageVal,
      postedBy: loggedInUser.username
    };
    jobs.push(job);
    LS.write("jobs", jobs);

    alert("Job posted successfully!");
    jobPostForm.reset();
    renderOfficerJobs();
  });
}

// Officer: Render own jobs
function renderOfficerJobs(){
  const list = document.getElementById("officerJobList");
  if(!list) return;
  const user = getLoggedInUser();
  const jobs = LS.read("jobs", [])
    .filter(j => j.postedBy === (user?.username ?? ""));

  if(jobs.length === 0){
    list.innerHTML = "<p class='muted'>No jobs posted yet.</p>";
    return;
  }
  list.innerHTML = jobs.map(j => `
    <div class="card">
      <div class="grid grid-2">
        <div>
          <h3>${j.title} <span class="badge">${j.company}</span></h3>
          <small class="muted">${j.location} • Apply by ${j.deadline}</small>
          <p>${j.description}</p>
        </div>
        <div>
          <p><b>Package:</b> ${j.package || "-"}</p>
          <p><b>Posted by:</b> ${j.postedBy}</p>
        </div>
      </div>
    </div>
  `).join("");
}

// ---------------------------
// Student: Load Jobs & Apply
// ---------------------------
function mountStudentJobs(){
  const list = document.getElementById("jobList");
  if(!list) return;

  requireRole("student");

  renderStudentJobs();
}

function renderStudentJobs(){
  const list = document.getElementById("jobList");
  if(!list) return;
  const jobs = LS.read("jobs", []);
  const user = getLoggedInUser();

  if(jobs.length === 0){
    list.innerHTML = "<p>No jobs available.</p>";
    return;
  }
  list.innerHTML = jobs.map(j => `
    <div class="card">
      <h3>${j.title} <span class="badge">${j.company}</span></h3>
      <small class="muted">${j.location} • Apply by ${j.deadline}</small>
      <p>${j.description}</p>
      <div class="nav">
        <button onclick="applyJob(${j.id})">Apply</button>
      </div>
    </div>
  `).join("");

  // Show student's applications
  const myApps = LS.read("applications", []).filter(a => a.username === user.username);
  const myAppsEl = document.getElementById("myApplications");
  if(myAppsEl){
    if(myApps.length === 0) myAppsEl.innerHTML = "<p class='muted'>No applications yet.</p>";
    else {
      myAppsEl.innerHTML = myApps.map(a => {
        const job = LS.read("jobs", []).find(j => j.id === a.jobId);
        if(!job) return "";
        return `<div class="card"><b>${job.title}</b> at ${job.company} — <small class="muted">applied</small></div>`;
      }).join("");
    }
  }
}

function applyJob(jobId){
  const user = getLoggedInUser();
  if(!user){ alert("Please login to apply."); return; }
  const apps = LS.read("applications", []);
  if(apps.some(a => a.username === user.username && a.jobId === jobId)){
    alert("You already applied for this job.");
    return;
  }
  apps.push({ id: Date.now(), jobId, username: user.username, status: "applied" });
  LS.write("applications", apps);
  alert("Application submitted!");
  renderStudentJobs();
}

// ---------------------------
// Officer: View Applications
// ---------------------------
function mountViewApplications(){
  const tbl = document.getElementById("appsTableBody");
  if(!tbl) return;
  requireRole("officer");

  const user = getLoggedInUser();
  const jobs = LS.read("jobs", []).filter(j => j.postedBy === user.username);
  const apps = LS.read("applications", [])
    .filter(a => jobs.some(j => j.id === a.jobId));

  if(apps.length === 0){
    tbl.innerHTML = "<tr><td colspan='5'>No applications yet.</td></tr>";
    return;
  }
  tbl.innerHTML = apps.map(a => {
    const job = jobs.find(j => j.id === a.jobId);
    return `<tr>
      <td>${a.username}</td>
      <td>${job?.title ?? "-"}</td>
      <td>${job?.company ?? "-"}</td>
      <td>${a.status}</td>
      <td>
        <button class="secondary" onclick="sendQuickMessage('${a.username}', 'Regarding your application for ${job?.title ?? ''}')">Message</button>
      </td>
    </tr>`;
  }).join("");
}

// ---------------------------
// Messaging
// ---------------------------
function mountSendMessage(){
  const form = document.getElementById("msgForm");
  if(!form) return;
  requireRole("officer");

  // populate students
  const users = LS.read("users", []);
  const students = users.filter(u => u.role === "student");
  const select = document.getElementById("msg_to");
  select.innerHTML = students.map(s => `<option value="${s.username}">${s.username}</option>`).join("");

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const to = document.getElementById("msg_to").value;
    const text = document.getElementById("msg_text").value.trim();
    const from = getLoggedInUser()?.username ?? "officer";
    if(!text){ alert("Message cannot be empty."); return; }
    const msgs = LS.read("messages", []);
    msgs.push({ id: Date.now(), to, from, text, ts: new Date().toISOString() });
    LS.write("messages", msgs);
    alert("Message sent!");
    form.reset();
  });
}

function sendQuickMessage(studentUsername, text){
  const from = getLoggedInUser()?.username ?? "officer";
  const msgs = LS.read("messages", []);
  msgs.push({ id: Date.now(), to: studentUsername, from, text, ts: new Date().toISOString() });
  LS.write("messages", msgs);
  alert("Quick message sent to " + studentUsername);
}

// Student: view inbox
function mountStudentInbox(){
  const inbox = document.getElementById("inbox");
  if(!inbox) return;
  requireRole("student");
  const user = getLoggedInUser();
  const msgs = LS.read("messages", []).filter(m => m.to === user.username).reverse();
  if(msgs.length === 0){
    inbox.innerHTML = "<p class='muted'>No messages yet.</p>";
  } else {
    inbox.innerHTML = msgs.map(m => `
      <div class="card"><b>From:</b> ${m.from}<br/><small class="muted">${new Date(m.ts).toLocaleString()}</small><p>${m.text}</p></div>
    `).join("");
  }
}

// ---------------------------
// Mounters per page
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  mountRegister();
  mountLogin();
  mountJobPost();
  mountStudentJobs();
  mountViewApplications();
  mountSendMessage();
  mountStudentInbox();

  // Header user state
  const user = getLoggedInUser();
  const who = document.getElementById("whoami");
  if(who) {
    who.textContent = user ? `${user.username} (${user.role})` : "Guest";
  }
});
