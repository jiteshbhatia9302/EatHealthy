const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, 'data.json');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


function readData(){
try{ 
	return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) 
   } 
catch(e){
	return { users: [],  menu: [] };
}//end catch
}//end readData function


function writeData(d){ 
fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); 
}

app.use(session({
secret: 'mySecretKey',
resave: false,
saveUninitialized: true,
cookie: { maxAge: 24*60*60*1000 }
}));


// Serve public static files
app.use(express.static(path.join(__dirname, 'public')));

// API: register.
//It receives the data and stores it in the JSON file
app.post('/register', (req, res)=>{
res.setHeader('Content-Type', 'text/html');
response = {
      name:req.body.name,
      email:req.body.email,
      password:req.body.password,
      credits: 10
   };
d=readData();
d.users.push(response);
writeData(d);
let output = `
    	<html>
    	<head><title>Order Summary</title></head>
	<link rel=stylesheet href=styles.css>
    	<body>
	<main class='container'>
	<table>
	<tr><th><h2 align="center">Registration successful</h2>
	<tr><th><h2>You are successfully registered. Please login using your email and password to continue</h2></th></table>
	<div align="center"><br>Click <a href=login.html>here</a> to login</div>
	</main>
    	</body></html>`
	res.end(output);
	return;
});


app.get('/login', async (req, res)=>{
const e=req.session.email;
data = readData();
const user = data.users.find(u => u.email === e);
if(!user){
res.redirect("/login.html");
}
else{
	req.session.order=true;
	const p=user.password;
	const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password:p })
    });
	const data = await response.text();
    	res.send(data);
}
});


// API: login.
//It receives the data and checks it in the JSON file
app.post('/login', (req, res)=>{
res.setHeader('Content-Type', 'text/html');
const { email, password } = req.body;
data = readData();
const user = data.users.find(u => u.email === email && u.password === password);
if(!user) {
res.write("invalid credentials");
res.end();
}
else{
res.write("<script src=script.js></script>");
req.session.email = user.email;
req.session.order=true;
c=user.credits;
res.write("<link rel=stylesheet href=styles.css>");
res.write("<main class='container'>");
res.write("<h3 style='float:right'>Welcome "+ user.name);
res.write("<br>Credits: <span id='credits'>"+c+"</span></h3>");
res.write("<form action=/order method=post><div id='menu'>");
res.write("<table border=0 style='height:50%'>")
res.write("<tr><th colspan=4><h2 align=center>Menu</h2></th></tr>");
for(i=0; i<data.menu.length;i++){
item=data.menu[i];
res.write("<tr><td style='padding:0px;'><input type=checkbox name=order value="+item.id+" id=c_"+item.id+" onclick=change(this.value)><td style='padding:0px;'>"+item.name+"("+item.type+")<td style='padding:0px;'>Rs. "+item.price+"<td style='padding:0px;'><input type=number name="+item.id+" value=0 disabled id=t_"+item.id+"></tr>");
}
res.write("<tr><th colspan=4 ><input type=submit value=OK></th></tr>");
res.write("</form>")
res.write("<form action=/logout method=post><tr><th colspan=4><button style='width:100px'>Logout</button></form>");
res.write("</table>");
res.write("</main>");
res.end();
}
});

app.get("/order", (req, res)=>{
res.redirect('/login.html');
});

app.post("/order", (req, res) => {
				if(!req.session.email){
					res.redirect('/');
					return;
				}
				let amount=0;
				const email=req.session.email;
				//console.log(email);
				data = readData();
				const user = data.users.find(u => u.email === email);
				const initial_credits=user.credits;
    				let creditsChange = 0; // positive for reward, negative for deduction
    				let selectedItems = req.body.order; // can be a string or array depending on how many selected
    				if (!selectedItems) {
        				let output = `
    								<html>
    								<head><title>Order Summary</title></head>
								<link rel=stylesheet href=styles.css>
    								<body>
								<main class='container'>
								<h2 align="center" style="float:right">Welcome ${user.name}</h2><br>
								<table>
								<tr><th><h2 align="center">Order Summary</h2>
								<tr><th><h2 style="color:red">No item selected</h2></th></table>
								<div align="center"><br><a href="/login">Place Another Order</a></div>
								<form action=/logout method=post><button style="width:100px;">Logout</button></form>
								</main>
    								</body></html>`
								res.end(output);
								return;
    				}//end if

			    // Convert single selection into an array for consistent handling
    				if (!Array.isArray(selectedItems)) {
        				selectedItems = [selectedItems];
    				}//end if
	    			let total = 0;
    				let output = `
    						<html>
    						<head><title>Order Summary</title></head>
						<link rel=stylesheet href=styles.css>
    						<body>
						<main class='container'>
						<h3 align="center" style="float:right">Welcome ${user.name}
    						</h3><br>
						<table border="1" align="center" cellpadding="8">
        					<tr><th colspan=5><h2 align="center">Order Summary</h2></th></tr>
						<tr><th>Item</th><th>Type</th><th>Price (Rs.)</th><th>Quantity</th><th>Amount</th></tr>`;

    				for (let i = 0; i < selectedItems.length; i++) {
        				const itemId = selectedItems[i];
        				const item = data.menu.find(m => m.id == itemId);
        				const qty = parseInt(req.body[itemId]) || 0;
					let discount = 0;
        				if (item && qty > 0) {
						if(item.type === 'healthy'){
							creditsChange = 2 * qty; // award
							discount = 0.20; // 20% discount
							discounted_price = Math.round(item.price * (1-discount));
							amount=discounted_price*qty;
							user.credits += creditsChange;			
						}//end if 
						else {
						// junk
							const costInCredits = 5 * qty;
							if(user.credits < costInCredits) 
							{
								let output = `
    								<html>
    								<head><title>Order Summary</title></head>
								<link rel=stylesheet href=styles.css>
    								<body>
								<main class='container'>
								<h2 align="center" style="float:right">Welcome ${user.name}</h2><br>
								<table>
								<tr><th><h2 align="center">Order Summary</h2>
								<tr><th><h2 style="color:red">Not enough credits for this order</h2></th></table>
								<div align="center"><br><a href="/login">Place Another Order</a></div>
								<form action=/logout method=post><button style="width:100px;">Logout</button></form>
								</main>
    								</body></html>`
								res.end(output);
								return;
							}//end if
							user.credits -= costInCredits;
							creditsChange = -costInCredits;
							amount=item.price*qty;
						}//end else
					total+=amount;
            				output += `
            					<tr>
                				<td>${item.name}</td>
                				<td>${item.type}</td>
                				<td>${item.price}</td>
                				<td>${qty}</td>
                				<td>${amount}</td>
            					</tr>`;
        			}//end if
    				}//end for
				if(!req.session.order){
				user.credits=initial_credits;
				}
				writeData(data);
				req.session.order=false;
    				output += `
        				<tr><th colspan="4" align="right">Total</th><th>${total}</th></tr>
					<tr><th colspan="4" align="right">Available credits</th><th>${user.credits}</th></tr>
					</table>
					<div align="center"><br><a href="/login">Place Another Order</a></div>
					<br>
					<div align="center">
					<form action="/logout" method="post">
      					<button style="width:100px;">Logout</button>
    					</form>
					</div>
					</main>
    					</body></html>`;
    					res.send(output);
					res.write("<script src=script.js></script>");
		});//End of route


app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Logout failed');
        }
        res.clearCookie('connect.sid'); // remove session cookie
        res.redirect('/login'); // or redirect to home page
    });
});


app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(500).send('Internal Server Error. Please try again later.');
    res.redirect('/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server started on port', PORT));