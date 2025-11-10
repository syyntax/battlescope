# BattleScope
BattleScope is a web application used to parse Nessus and Nmap files to show discovery information like hostnames, open ports, services, and vulnerabilities. BattleScope will allow users to upload a `.nessus` file or an Nmap XML file which it will parse into a SQLite database. The web application front-end will consist of 3 panes (left, middle, and right). The left-hand pane will provide common SQL queries. When a user clicks on this query, it will query the database and display the results of the query. The middle pane will provide functionality to upload the required Nessus or Nmap file. Below that, there will be an input field where users can write and submit their own SQL queries. When a user clicks on a pre-defined query in the left pane, the query will populate in the input field. The right pane will provided statistics of the uploaded file.

Below describes the functionality and style of the web app.

## Title
The title of this web application is "BattleScope". The author of this application is me: `syyntax`. My email is `syyntax@protonmail.com`.

## Style
The web app will consist of dark mode and light mode themes; it will allow users to switch between the two. The default will be the user's system settings.

The web app will have a modern and sleek styling. It will utilize these fonts in its CSS:
```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300..700&family=Genos:ital,wght@0,100..900;1,100..900&family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&family=Iceberg&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Sanchez:ital@0;1&display=swap');
```
The `h1` style will use the `Genos` font. `h2` and other headers will use the `PT Sans` font. The font in the middle input field will be `Google Sans Code`. All other fonts will be `JetBrains Mono`.

The colors should be a mix of purples and blues. Light mode background should be white; Dark mode background should be a dark gray.

## Top Menu Bar
The top menu bar (navigation bar) should include the title: "BattleScope" to the far left-hand side of the page. 

## Middle Pane
The middle pane should be larger than the other two since this is where most of the interaction occurs. It includes the upload feature, the input field for writing SQL queries, and the query results. When a user queries the database, the results should show the count of rows the to top-left above the results. To the top-right of the results should be an "Export CSV" button that exports the results to a CSV.

## Left Pane
The left pane has pre-built links that will query the database. Let's leave this blank for now.

## Right Pane
The right pane will start with a scan summary that inclused the name of the file. Beneath that, it will show the count of hosts included in the scan. If a Nessus scan was uploaded, then the pane should show the count of severities found (i.e., Critical, High, Medium, Low, Info). Next, the pane should show the top 10 ports (including protocol, service name, and count). Next, the pane should show the top 10 Operating systems (including count).