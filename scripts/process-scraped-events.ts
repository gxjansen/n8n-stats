/**
 * Process scraped Luma events data
 * This uses the data captured via Puppeteer scraping
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Scraped event data from Puppeteer (captured from luma.com/n8n-events?k=c)
// Format: id, text (containing name, location, attendance), date
// Includes both upcoming (2026+) and past events
const scrapedEvents = [
  // Upcoming events (2026)
  { id: "0wpea1i7", text: "9:00New Year, New Me: Kickstart the Year with AI & Automation – n8n Coworking @ The Delta Campus Berlin​By n8n & Marcel Claus-Ahrens​The Delta Campus​Waiting list+45", date: "12 Jan 2026" },
  { id: "vm66a4iu", text: "18:00n8n Vienna Community Meetup​By n8n & Cristian Livadaru​Marxergasse 24/2​Meetup+56", date: "14 Jan 2026" },
  { id: "bgug47b9", text: "18:00Cologne n8n Meetup​By n8n & Friedemann Schuetz​STARTPLATZ​Meetup+68", date: "15 Jan 2026" },
  { id: "pdjrjhrm", text: "16:00n8n Starter Workshop - Vienna​By n8n & Cristian Livadaru​Wirtschaftsagentur Wien​Meetup​Near Capacity+33", date: "19 Jan 2026" },
  { id: "t6v9zyw4", text: "19:00AI Agents with n8n: Build Your First AI Agent with n8n (Beginner Workshop, Virtual)​By Aemal Sayer​Virtual+842", date: "20 Jan 2026" },
  { id: "150rb6e0", text: "17:00n8n Copenhagen: AI Document Triage (PDF Parsing)​By n8n, Lars Emil, Erik Møiniche-Kiebe & Olga Safonova​København+19", date: "22 Jan 2026" },
  { id: "1ower26h", text: "3:00San Francisco n8n Meetup with Jan Oberhauser, Founder & CEO of n8n​By n8n, Dylan Watkins & Cyril Attia​972 Mission St+669", date: "28 Jan 2026" },
  { id: "f9synbbf", text: "16:30Tel Aviv Community Meetup​By n8n, Elay Guez, Gilad Shoham & Leon Melamud​Menakhem Begin Rd 121​Waiting list+408", date: "29 Jan 2026" },
  { id: "07k0nnqa", text: "18:00n8n Budapest Hackathon​By n8n & Németh Dávid​Puzl CowOrKing Budapest​Meetup+41", date: "30 Jan 2026" },
  { id: "external1", text: "10:15Architect and Build Reliable Agents and Workflows with n8n and Small Models​London, E1 7HA​Workshop​External", date: "6 May 2026" },
  // Past events (2021-2025)
  { id: "b0vxn0ar", text: "17:30n8n Virtual Coworking​By n8n & Alex Kim​Google Meet+54", date: "20 Dec 2025" },
  { id: "3awp1vca", text: "15:00n8n Amsterdam Coworking​By n8n & Marrallisa Kreijkes​Amsterdam, Noord-Holland+58", date: "22 Dec 2025" },
  { id: "mhdjwmek", text: "17:00🎄 December Hangout - 2025 in Review & Community Awards​By n8n​YouTube+1.4K", date: "18 Dec 2025" },
  { id: "gz165drz", text: "15:0018-Hour Live Build with n8n + Vibe Coding​By Aemal Sayer​Virtual​Livestream+668", date: "18 Dec 2025" },
  { id: "mqnvl467", text: "22:00 · 16:00 GMT-5n8n Starter Sessions: Toronto​By n8n, Aemal Sayer, Christian Voigt & Avanai​Workplace One Office Space & Coworking​Starter Sessions​Workshop​Waiting list+215", date: "17 Dec 2025" },
  { id: "tff6gvms", text: "19:00 · 18:00 GMTElevenLabs Worldwide Hackathon with n8n​By n8n​30 locations [check the link for more info]+67", date: "11 Dec 2025" },
  { id: "l2ztgx5g", text: "23:00 · 16:00 GMT-6n8n Starter Sessions: Chicago, IL​By n8n, Aemal Sayer, Christian Voigt & Avanai​Workbox Chicago - River North​Starter Sessions​Workshop+142", date: "10 Dec 2025" },
  { id: "81wyd2vh", text: "16:00n8n Builder Sessions: Amsterdam [Intermediate level]​By n8n, Aemal Sayer, Christian Voigt & Avanai​The Social Hub Amsterdam City​Starter Sessions​Workshop+174", date: "10 Dec 2025" },
  { id: "cmjwxppw", text: "8:00 · 10:00 GMT+3Nairobi n8n Network (nn8nn) Hackathon (Edition 3)​By Ombasa Anyona, Phyl Georgiou, Zacharia Kimotho & n8n​Nairobi, Nairobi County​Hackathon​Sold Out+73", date: "6 Dec 2025" },
  { id: "r4kke3yq", text: "22:00 · 16:00 GMT-5n8n Starter Sessions: Atlanta, GA​By n8n, Aemal Sayer & Christian Voigt​Roam Buckhead - Peachtree​Starter Sessions​Workshop+127", date: "3 Dec 2025" },
  { id: "pa3n4l90", text: "17:00Amsterdam n8n Meetup​By n8n, Marrallisa Kreijkes, Tino Zwirs & Stefano Manese​Amsterdam, Noord-Holland​Meetup+136", date: "3 Dec 2025" },
  { id: "b55z0gkr", text: "16:00n8n Builder Sessions: Barcelona [Intermediate level]​By n8n, Aemal Sayer & Christian Voigt​The Social Hub Barcelona Poblenou​Starter Sessions​Workshop+218", date: "3 Dec 2025" },
  { id: "ld18cuxw", text: "17:00Zürich n8n Community Meetup​By n8n & Robert Schröder​Trichtenhauser Str. 57, 8125 Zollikerberg, Schweiz​Meetup+27", date: "29 Nov 2025" },
  { id: "fagpkenv", text: "9:30AI Automation Hackathon powered by n8n - Milan​By Yellow Tech & Gianmaria Monteleone​Via Polidoro da Caravaggio, 37​Hackathon", date: "29 Nov 2025" },
  { id: "buildupday", text: "5:00 · 13:00 GMT+9[n8n Seoul Event] BUILD-UP Day​By n8n, Inyoung Lee & Sophie​Seoul​Near Capacity+101", date: "29 Nov 2025" },
  { id: "m608zxio", text: "14:00 · 16:00 GMT+3n8n Starter Sessions: Istanbul​By n8n, Aemal Sayer & Christian Voigt​Impact Hub Istanbul​Starter Sessions​Workshop​Waiting list+246", date: "26 Nov 2025" },
  { id: "p3y7x54p", text: "3:00 · 25 Nov, 18:00 GMT-8San Francisco n8n Meetup​By n8n, Dylan Watkins, Cyril Attia, Alison Granger & 1 other​972 Mission St​Meetup+583", date: "26 Nov 2025" },
  { id: "ieg87a5p", text: "9:00n8n Vienna Coworking Session​By n8n & Cristian Livadaru​Marxergasse 24/2​Waiting list+15", date: "25 Nov 2025" },
  { id: "mt8wkdkx", text: "12:00 · 15:00 GMT+4Dubai n8n Cowork Day​By n8n & Marrallisa Kreijkes​Dubai, Dubai​Meetup+9", date: "24 Nov 2025" },
  { id: "y8ge2ry2", text: "23:30 · 16:30 GMT-6n8n Live Dallas TX​By SOFT PYRAMID LLC, n8n & Sharjeel Shahab​Common Desk - Richardson​Sold Out+81", date: "20 Nov 2025" },
  { id: "2k1vej68", text: "17:30n8n Meetup Düsseldorf hosted by SuperCode​By n8n, Marcel Claus-Ahrens, SuperCode & Anastasiya Zhu​SuperCode GmbH & Co. KG​Meetup​Workshop+46", date: "20 Nov 2025" },
  { id: "ksdrq1fx", text: "23:30 · 17:30 GMT-5NYC n8n Community Meetup​By n8n, Amaurys Valdez & Bertrand Besson​New York, New York​Meetup+87", date: "19 Nov 2025" },
  { id: "xqmhif2u", text: "23:00 · 16:00 GMT-6n8n Starter Sessions: Austin, TX​By n8n, Aemal Sayer & Christian Voigt​Central District Brewing​Starter Sessions​Workshop+236", date: "19 Nov 2025" },
  { id: "x08phdye", text: "16:00n8n Starter Sessions: Madrid​By n8n, Aemal Sayer, Christian Voigt & Avanai​C. de Vizcaya, 12​Starter Sessions​Workshop+233", date: "19 Nov 2025" },
  { id: "m4r46i4l", text: "3:00 · 18 Nov, 18:00 GMT-8Los Angeles n8n Meetup​By n8n, AI LA, Dylan Watkins, Fil Graniczny & 3 others​Los Angeles, California​Meetup", date: "19 Nov 2025" },
  { id: "1vupr9l5", text: "22:00 · 16:00 GMT-5n8n Starter Sessions: Miami, FL​By n8n, Christian Voigt, Aemal Sayer & Avanai​Mana Tech Loft 10​Starter Sessions​Workshop+165", date: "12 Nov 2025" },
  { id: "h202x3up", text: "18:00Vienna Community Meetup: November​By n8n, Cristian Livadaru, Andra Stanciu & Bahar Narinç​Das Packhaus​Meetup+104", date: "12 Nov 2025" },
  { id: "3zo9qp1d", text: "17:00 · 16:00 WETn8n Starter Sessions: Lisbon​By n8n, Christian Voigt, Aemal Sayer & Avanai​Impact Hub Lisbon - Penha​Starter Sessions​Workshop+223", date: "12 Nov 2025" },
  { id: "7yksvt8l", text: "17:30n8n Copenhagen: Learn to build AI-workflows (in-person, hands-on session)​By Lars Emil, Anja Wedell & Erik Møiniche-Kiebe​København​Workshop​Sold Out", date: "6 Nov 2025" },
  { id: "pqbp1o3f", text: "1:00 · 5 Nov, 16:00 GMT-8n8n Starter Sessions: Los Angeles, CA​By n8n, Aemal Sayer, Christian Voigt & Avanai​333 S Grand Ave suite 3310​Starter Sessions​Workshop+184", date: "6 Nov 2025" },
  { id: "piz7bk38", text: "16:00n8n Starter Sessions: Vienna​By n8n, Christian Voigt, Aemal Sayer & Avanai​The Social Hub Restaurant & Bar Vienna​Starter Sessions​Workshop+175", date: "5 Nov 2025" },
  { id: "03p8f5ws", text: "17:00n8n Livestream: AI Guardrails, Pinecone & Community Highlights​By n8n​YouTube+1.5K", date: "30 Oct 2025" },
  { id: "y48isqcy", text: "16:00n8n Starter Sessions: Zurich​By n8n, Aemal Sayer, Christian Voigt & Avanai​Impact Hub Zürich - Viadukt​Starter Sessions​Workshop+173", date: "29 Oct 2025" },
  { id: "b09frqxp", text: "16:00n8n Starter Sessions: Warsaw​By n8n, Aemal Sayer, Christian Voigt & Avanai​Centralny Dom Technologii​Starter Sessions​Workshop+197", date: "22 Oct 2025" },
  { id: "h6492xt0", text: "3:00 · 16 Oct, 18:00 GMT-7San Diego 10x Founders - Using n8n for agentic operations​By n8n, Dylan Watkins & Nancy Hsiu​4910 El Secreto​Meetup+118", date: "17 Oct 2025" },
  { id: "mkmmldd0", text: "18:30Paris Meetup: Automations for Freelancers and Solopreneurs​By n8n, Nayel Ferai & Claire Champourlier​21 Rue Albert Bayet​Workshop+238", date: "16 Oct 2025" },
  { id: "ffaf196z", text: "17:00 · 16:00 BSTn8n Starter Sessions: London​By n8n, Aemal Sayer & Christian Voigt​Second Home Spitalfields​Starter Sessions​Workshop+267", date: "15 Oct 2025" },
  { id: "0u5pgbl6", text: "3:00 · 14 Oct, 18:00 GMT-7San Francisco n8n Meetup​By n8n, Dylan Watkins, Cyril Attia, Alison Granger & 1 other​972 Mission St​Meetup​Near Capacity+754", date: "15 Oct 2025" },
  { id: "2i3j14jd", text: "18:30 · 17:30 BSTLondon Meetup​By n8n, Simon Bocca, Melinda Varga & Bart Veldhuizen​79-81 Borough Rd​Meetup+229", date: "14 Oct 2025" },
  { id: "jl44ufhi", text: "18:30Nantes n8n Community Meetup​By n8n, Claire Champourlier & Amandine Dugrain​Guest Suite​Meetup​Sold Out+49", date: "14 Oct 2025" },
  { id: "31yeadlc", text: "17:00n8n at SCALE: Practical Strategies for Optimizing RAG​By n8n, Desiree & Angel Menendez​YouTube+1.8K", date: "14 Oct 2025" },
  { id: "edudoe5i", text: "12:00 · 10:00 GMTn8n Ghana – Accra Community Meetup (October 2025)​By Johnathan Lightfoot & Sandra​Accra, Greater Accra Region​Meetup​Waiting list+55", date: "11 Oct 2025" },
  { id: "j3b76ibw", text: "0:00 · 10 Oct, 18:00 GMT-4n8n meetup NYC- Community Hosted​By Sandeep Patharkar, Robert Breen, David E & Amaurys Valdez​31-10 Thomson Ave+81", date: "11 Oct 2025" },
  { id: "3zbx6yr2", text: "17:00n8n Partner Event: Learn to build SOPs & automate workflows with Baserow​By n8n & Angel Menendez​Virtual+11", date: "9 Oct 2025" },
  { id: "l55aam87", text: "15:00Amsterdam n8n Cowork Day​By n8n & Marrallisa Kreijkes​Amsterdam, Noord-Holland", date: "9 Oct 2025" },
  { id: "dozxddef", text: "7:00 · 10:00 GMT+5N8N CONNECTED SUMMIT​By Hashim Orhan​Government Degree College Zhob+28", date: "9 Oct 2025" },
  { id: "qcqn822y", text: "22:00 · 16:00 GMT-4n8n Starter Sessions: NYC​By n8n, Aemal Sayer, Christian Voigt & Avanai​Verci Flatiron​Starter Sessions​Near Capacity+191", date: "8 Oct 2025" },
  { id: "ztg4b822", text: "18:45n8n community night - BE​By Maarten van Dun​Voka - Kamer van Koophandel Gent (Oost-Vlaanderen)", date: "7 Oct 2025" },
  { id: "serq29pp", text: "13:00n8n LIVE Karachi – Hands-on Automation Workshop​By SOFT PYRAMID LLC​Zoom+43", date: "3 Oct 2025" },
  { id: "v4hdajh9", text: "10:00Berlin Work & Meet​By n8n & Marrallisa Kreijkes​Berlin, Berlin+20", date: "3 Oct 2025" },
  { id: "7u33hxob", text: "23:00n8n Latam: Conecta, automatiza y crea agentes con AI Edicion Centroamerica​By Erick Alexander Torres Prado​Zoom+87", date: "2 Oct 2025" },
  { id: "ji8w10bk", text: "16:00n8n Builders Berlin​By n8n & Tino Zwirs​CIC Berlin​Conference+259", date: "2 Oct 2025" },
  { id: "50ubl92t", text: "17:00n8n Community Livestream​By n8n​YouTube​Livestream+1.2K", date: "1 Oct 2025" },
  { id: "ztch4mib", text: "12:00 · 18:00 GMT+8Taipei n8n Meetup​By TigerAI-Taiwan​110台北市信義區菸廠路88號8F-1​Meetup​Waiting list+91", date: "26 Sep 2025" },
  { id: "zaswupvt", text: "16:00n8n Starter Sessions: Frankfurt​By n8n, Aemal Sayer & Christian Voigt​Mindspace Eurotheum​Starter Sessions​Workshop+159", date: "24 Sep 2025" },
  { id: "q4e3defx", text: "7:30 · 10:30 GMT+5n8n Live Islamabad​By SOFT PYRAMID LLC & n8n​National Incubation Center for Aerospace Technologies - NICAT​Meetup​Sold Out+132", date: "20 Sep 2025" },
  { id: "w700n18b", text: "16:30n8n Starter Sessions: Paris - LIVESTREAM​By n8n​YouTube​Livestream​Starter Sessions+385", date: "17 Sep 2025" },
  { id: "g5cyltgb", text: "16:00n8n Starter Sessions: Paris​By n8n, Aemal Sayer & Christian Voigt​Mitwit Office Paris 3 Marais​Starter Sessions​Workshop​Near Capacity+244", date: "17 Sep 2025" },
  { id: "klsdaity", text: "1:00 · 10 Sept, 16:00 GMT-7n8n Starter Sessions: San Francisco​By n8n, Aemal Sayer & Christian Voigt​CANOPY Jackson Square​Near Capacity+244", date: "11 Sep 2025" },
  { id: "66scgfaw", text: "18:00Vienna n8n meetup - Enterprise edition​By n8n, Cristian Livadaru, Bahar Narinç & Andra Stanciu​Das Packhaus​Meetup+147", date: "10 Sep 2025" },
  { id: "fi2sqyiv", text: "3:00 · 9 Sept, 18:00 GMT-7Los Angeles n8n Meetup​By n8n, AI LA, Fil Graniczny & Dylan Watkins​Los Angeles, California​Meetup", date: "10 Sep 2025" },
  { id: "ur79vcr0", text: "16:00n8n Starter Sessions: Barcelona​By n8n, Aemal Sayer & Christian Voigt​The Social Hub Barcelona Poblenou+267", date: "3 Sep 2025" },
  { id: "ms8cebns", text: "16:00n8n Starter Sessions: Amsterdam - LIVESTREAM​By n8n​YouTube+1.2K", date: "28 Aug 2025" },
  { id: "kut6ppvn", text: "16:00n8n Starter Sessions: Amsterdam​By n8n, Aemal Sayer & Christian Voigt​The Social Hub Amsterdam City​Waiting list+198", date: "28 Aug 2025" },
  { id: "v5e12e30", text: "17:00n8n Community Livestream: Updates, updates, updates!​By n8n​YouTube+1.3K", date: "21 Aug 2025" },
  { id: "z1fhi70q", text: "18:00Automate a Personalized Newsletter Using Real-time Data & AI Agents​By n8n & Desiree​Virtual+1.2K", date: "19 Aug 2025" },
  { id: "mh9fv58n", text: "3:00 · 29 Jul, 18:00 GMT-7AI LA Salon with n8n​By n8n, AI LA, Dylan Watkins & Fil Graniczny​Los Angeles, California​Near Capacity", date: "30 Jul 2025" },
  { id: "2k0owxfs", text: "3:00 · 24 Jul, 18:00 GMT-7San Francisco n8n Meetup - Voice RAG AI Agents and More​By n8n, Dylan Watkins, Alison Granger & Alison Granger ​972 Mission St​Waiting list+496", date: "25 Jul 2025" },
  { id: "6kp81nzo", text: "0:00Sāo Paulo n8n Hangout - Escalabilidade do n8n​By n8n & Luiz Eduardo Oliveira Fonseca​Google Meet+404", date: "22 Jul 2025" },
  { id: "up18ju9g", text: "12:00 · 13:00 EESTMASC + n8n Summer Meetup Kyiv​By n8n, Max Tkacz & Svitlana M​Kyiv, Kyiv+10", date: "18 Jul 2025" },
  { id: "l12u2e82", text: "7:00 · 14:00 GMT+9Seoul Community Meetup​By n8n & 박정기​ICT COC", date: "6 Jul 2025" },
  { id: "rfniiq2c", text: "17:00From Prompt to Production: Smarter AI with Evaluations​By n8n, Desiree & Angel Menendez​YouTube+1.4K", date: "2 Jul 2025" },
  { id: "6zbnge6y", text: "3:00 · 25 Jun, 18:00 GMT-7San Francisco n8n Meetup​By n8n, Dylan Watkins, Alison Granger & Alison Granger ​972 Mission St+299", date: "26 Jun 2025" },
  { id: "a9jv5pyv", text: "18:00Barcelona n8n Meetup​By n8n, Baptiste Jacquemet, Pep Oliveras & Javier Quilez​Canòdrom - Ateneu d'Innovació Digital i Democràtica+104", date: "25 Jun 2025" },
  { id: "fwv20c43", text: "18:00German Community Online Meetup​By n8n, Marcel Claus-Ahrens & Friedemann Schuetz​Zoom​Waiting list+145", date: "10 Jun 2025" },
  { id: "lx0a1fom", text: "17:00n8n Community Livestream: Community Nodes and Evaluations​By n8n​YouTube+870", date: "2 Jun 2025" },
  { id: "fvwb3net", text: "22:00 · 15:00 GMT-5St Louis Workshop​By n8n, Nate Haskins & Tino Zwirs​Cologne", date: "31 May 2025" },
  { id: "wxtdugmh", text: "17:00n8n at SCALE: Office Hours for Scaling Teams & Enterprises​By n8n & Angel Menendez​YouTube+897", date: "21 May 2025" },
  { id: "705zeeo3", text: "18:00Barcelona n8n Meetup​By n8n, Baptiste Jacquemet, Javier Quilez & Pep Oliveras​Canòdrom - Ateneu d'Innovació Digital i Democràtica+88", date: "30 Apr 2025" },
  { id: "kq7ebzm0", text: "18:00Cologne n8n Meetup​By n8n & Friedemann Schuetz​KONSTANTIN Cologne​Waiting list+74", date: "24 Apr 2025" },
  { id: "y66k6q0j", text: "18:00n8n at SCALE: Office Hours for Scaling Teams & Enterprises​By n8n & Angel Menendez​YouTube+598", date: "11 Apr 2025" },
  { id: "tj485vce", text: "17:00Amsterdam Meetup​By n8n & Tino Zwirs​StartDock Coworking Prins Hendrikkade​Waiting list+121", date: "10 Apr 2025" },
  { id: "6b24dz7d", text: "17:30Los Angeles n8n Community Hangout​By n8n, Alex Kim & Zubair Trabzada​Google Meet​Waiting list+85", date: "2 Apr 2025" },
  { id: "4xtpb16b", text: "17:00Automate Your Ideas: Introduction to n8n and Workflow Magic​By n8n & Simon Hryszko​Rzeszów, Podkarpackie Voivodeship​Sold Out", date: "20 Mar 2025" },
  { id: "kjpz30nj", text: "17:00n8n at SCALE: Office Hours for Scaling Teams & Enterprises​By n8n & Angel Menendez​YouTube+674", date: "19 Mar 2025" },
  { id: "z0leoquh", text: "23:00São Paulo Hangout​By n8n & Luiz Eduardo Oliveira Fonseca​Zoom+133", date: "17 Mar 2025" },
  { id: "ep4eo2nm", text: "23:00São Paulo Hangout​By n8n & Luiz Eduardo Oliveira Fonseca​Zoom+88", date: "24 Feb 2025" },
  { id: "duxpz96i", text: "17:00n8n at SCALE: Office Hours for Scaling Teams & Enterprises​By n8n & Angel Menendez​YouTube+470", date: "19 Feb 2025" },
  { id: "ic15c18x", text: "23:30Meetup: Como Homologar Versões do N8N​By n8n & Luiz Eduardo Oliveira Fonseca​Zoom+98", date: "4 Nov 2024" },
  { id: "wz49x7ud", text: "0:00Meetup São Paulo - Tudo sobre N8N com IA Local​By n8n & Luiz Eduardo Oliveira Fonseca​Zoom+167", date: "4 Sep 2024" },
  { id: "fmw7buml", text: "13:00 · 08:00 GMT-3Meetup São Paulo Agosto 2024 (Presencial)​By n8n & Luiz Eduardo Oliveira Fonseca​Av. Paulista, 807​Meetup​Sold Out+35", date: "10 Aug 2024" },
  { id: "2qridfcx", text: "0:00Meetup São Paulo: Automação de Marketing com N8N​By n8n & Luiz Eduardo Oliveira Fonseca​Zoom​Hangout+75", date: "23 Jul 2024" },
  { id: "p6rsz2gt", text: "0:00Meetup São Paulo: Tudo sobre Community Nodes​By n8n & Luiz Eduardo Oliveira Fonseca​Zoom+127", date: "9 Jul 2024" },
  { id: "5k5gsq2o", text: "17:002024 Mid Year Gen AI Zoo​By Yujian Tang​YouTube​Conference+496", date: "27 Jun 2024" },
  { id: "njxwr3si", text: "0:00N8N Meetup São Paulo: Tudo sobre o Creators Hub​By n8n & Luiz Eduardo Oliveira Fonseca​Zoom", date: "25 Jun 2024" },
  { id: "r39a7f2g", text: "0:00N8N Meetup São Paulo: The Automation Market with N8N​By n8n & Luiz Eduardo Oliveira Fonseca​Zoom", date: "11 Jun 2024" },
  { id: "sadasdasd", text: "17:00n8n Community Meetup 🖖 #9​By n8n​Zoom", date: "15 Jun 2022" },
  { id: "3wps8ykc", text: "17:00n8n community icebreaker ☀️​By n8n​Virtual​Near Capacity", date: "21 May 2021" },
  { id: "pxk3alqp", text: "14:30How to build a newsletter system with n8n 📧​By n8n​Virtual​Sold Out", date: "14 May 2021" },
  { id: "p9j1vm05", text: "17:00n8n Community Meetup 🎉​By n8n​Zoom", date: "7 May 2021" },
  { id: "oyh1r2n2", text: "17:00How to build low-code APIs and dashboards 🚀​By n8n​Virtual", date: "6 May 2021" },
  { id: "usypswvq", text: "17:00How to use JavaScript in n8n 💻​By n8n​Virtual", date: "29 Apr 2021" },
  { id: "rr36ztm4", text: "16:30How to scale your n8n instance 🗻​By n8n​Virtual", date: "22 Apr 2021" },
];

// Country coordinates for mapping
const countryCoordinates: Record<string, { lat: number; lng: number }> = {
  'Netherlands': { lat: 52.3676, lng: 4.9041 },
  'Germany': { lat: 52.5200, lng: 13.4050 },
  'United States': { lat: 37.7749, lng: -122.4194 },
  'USA': { lat: 37.7749, lng: -122.4194 },
  'France': { lat: 48.8566, lng: 2.3522 },
  'Spain': { lat: 41.3851, lng: 2.1734 },
  'Austria': { lat: 48.2082, lng: 16.3738 },
  'Switzerland': { lat: 47.3769, lng: 8.5417 },
  'UK': { lat: 51.5074, lng: -0.1278 },
  'United Kingdom': { lat: 51.5074, lng: -0.1278 },
  'Poland': { lat: 52.2297, lng: 21.0122 },
  'Portugal': { lat: 38.7223, lng: -9.1393 },
  'Italy': { lat: 45.4642, lng: 9.1900 },
  'Belgium': { lat: 50.8503, lng: 4.3517 },
  'Turkey': { lat: 41.0082, lng: 28.9784 },
  'Kenya': { lat: -1.2921, lng: 36.8219 },
  'Ghana': { lat: 5.6037, lng: -0.1870 },
  'Pakistan': { lat: 33.6844, lng: 73.0479 },
  'South Korea': { lat: 37.5665, lng: 126.9780 },
  'Taiwan': { lat: 25.0330, lng: 121.5654 },
  'Brazil': { lat: -23.5505, lng: -46.6333 },
  'UAE': { lat: 25.2048, lng: 55.2708 },
  'Ukraine': { lat: 50.4501, lng: 30.5234 },
  'Denmark': { lat: 55.6761, lng: 12.5683 },
  'Israel': { lat: 32.0853, lng: 34.7818 },
  'Hungary': { lat: 47.4979, lng: 19.0402 },
  'Canada': { lat: 43.6532, lng: -79.3832 },
};

// City to country mapping
const cityToCountry: Record<string, string> = {
  'Amsterdam': 'Netherlands',
  'Berlin': 'Germany',
  'San Francisco': 'United States',
  'Los Angeles': 'United States',
  'New York': 'United States',
  'NYC': 'United States',
  'Chicago': 'United States',
  'Austin': 'United States',
  'Miami': 'United States',
  'Atlanta': 'United States',
  'Dallas': 'United States',
  'San Diego': 'United States',
  'Toronto': 'Canada',
  'Tel Aviv': 'Israel',
  'Budapest': 'Hungary',
  'Paris': 'France',
  'Barcelona': 'Spain',
  'Madrid': 'Spain',
  'Vienna': 'Austria',
  'Zürich': 'Switzerland',
  'Zurich': 'Switzerland',
  'London': 'United Kingdom',
  'Warsaw': 'Poland',
  'Lisbon': 'Portugal',
  'Milan': 'Italy',
  'Nantes': 'France',
  'Cologne': 'Germany',
  'Frankfurt': 'Germany',
  'Düsseldorf': 'Germany',
  'Istanbul': 'Turkey',
  'Nairobi': 'Kenya',
  'Accra': 'Ghana',
  'Islamabad': 'Pakistan',
  'Karachi': 'Pakistan',
  'Seoul': 'South Korea',
  'Taipei': 'Taiwan',
  'São Paulo': 'Brazil',
  'Dubai': 'UAE',
  'Kyiv': 'Ukraine',
  'København': 'Denmark',
  'Copenhagen': 'Denmark',
  'Gent': 'Belgium',
  'Rzeszów': 'Poland',
};

interface LumaEvent {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  url: string;
  location: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
  };
  isOnline: boolean;
  registrations: number;
}

function parseAttendance(text: string): number {
  const match = text.match(/\+(\d+(?:\.\d+)?)(K?)/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  return match[2] === 'K' ? Math.round(num * 1000) : num;
}

function extractEventName(text: string): string {
  // Remove time prefix (e.g., "17:00" or "17:00 · 16:00 GMT-5")
  let name = text.replace(/^\d{1,2}:\d{2}(?:\s*·\s*(?:\d{1,2}\s+\w+,\s*)?\d{1,2}:\d{2}\s*(?:GMT[+-]?\d+)?)?/, '').trim();

  // Get text before "By " or special characters
  const byIndex = name.indexOf('By ');
  if (byIndex > 0) {
    name = name.substring(0, byIndex).trim();
  }

  // Clean up special characters used as separators
  name = name.replace(/[​]/g, ' ').trim();

  return name || 'n8n Community Event';
}

function extractLocation(text: string): { city: string; country: string; isOnline: boolean } {
  const textLower = text.toLowerCase();

  // Check for online indicators
  const isOnline = textLower.includes('virtual') ||
                   textLower.includes('zoom') ||
                   textLower.includes('youtube') ||
                   textLower.includes('google meet') ||
                   textLower.includes('livestream');

  if (isOnline) {
    return { city: 'Online', country: 'Online', isOnline: true };
  }

  // Try to find city in the text
  for (const [city, country] of Object.entries(cityToCountry)) {
    if (text.includes(city)) {
      return { city, country, isOnline: false };
    }
  }

  return { city: '', country: '', isOnline: false };
}

function parseDate(dateStr: string): string {
  // Parse date like "22 Dec 2025" to ISO format
  const months: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Sept': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };

  const match = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+(\d{4})/i);
  if (!match) return '';

  const [_, day, month, year] = match;
  const monthNum = months[month] || '01';
  return `${year}-${monthNum}-${day.padStart(2, '0')}T17:00:00Z`;
}

function processEvents(): LumaEvent[] {
  const events: LumaEvent[] = [];

  for (const scraped of scrapedEvents) {
    const name = extractEventName(scraped.text);
    const { city, country, isOnline } = extractLocation(scraped.text);
    const registrations = parseAttendance(scraped.text);
    const startDate = parseDate(scraped.date);

    // Get coordinates
    let coordinates: { lat: number; lng: number } | undefined;
    if (!isOnline && country && countryCoordinates[country]) {
      coordinates = countryCoordinates[country];
    }

    events.push({
      id: scraped.id,
      name,
      startDate,
      url: `https://lu.ma/${scraped.id}`,
      location: {
        name: isOnline ? 'Online' : (city || 'TBA'),
        city: city || '',
        country: country || '',
        coordinates,
      },
      isOnline,
      registrations,
    });
  }

  return events;
}

interface MonthlyData {
  month: string;
  count: number;
  registrations: number;
  inPersonCount: number;
  inPersonRegistrations: number;
  onlineCount: number;
  onlineRegistrations: number;
}

function groupByMonth(events: LumaEvent[]): MonthlyData[] {
  const byMonth = new Map<string, MonthlyData>();

  for (const event of events) {
    if (!event.startDate) continue;
    const date = new Date(event.startDate);
    if (isNaN(date.getTime())) continue;

    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = byMonth.get(month) || {
      month,
      count: 0,
      registrations: 0,
      inPersonCount: 0,
      inPersonRegistrations: 0,
      onlineCount: 0,
      onlineRegistrations: 0,
    };

    existing.count++;
    existing.registrations += event.registrations;

    if (event.isOnline) {
      existing.onlineCount++;
      existing.onlineRegistrations += event.registrations;
    } else {
      existing.inPersonCount++;
      existing.inPersonRegistrations += event.registrations;
    }

    byMonth.set(month, existing);
  }

  return Array.from(byMonth.values())
    .sort((a, b) => a.month.localeCompare(b.month));
}

function groupByCountry(events: LumaEvent[]): Array<{ country: string; count: number; registrations: number; coordinates?: { lat: number; lng: number } }> {
  const byCountry = new Map<string, { country: string; count: number; registrations: number; coordinates?: { lat: number; lng: number } }>();

  for (const event of events) {
    if (event.isOnline) continue;

    const country = event.location.country || 'Unknown';
    if (!country || country === 'Unknown') continue;

    const existing = byCountry.get(country) || {
      country,
      count: 0,
      registrations: 0,
      coordinates: event.location.coordinates,
    };

    byCountry.set(country, {
      ...existing,
      count: existing.count + 1,
      registrations: existing.registrations + event.registrations,
    });
  }

  return Array.from(byCountry.values()).sort((a, b) => b.count - a.count);
}

function aggregateLocations(events: LumaEvent[]): Array<{ name: string; city: string; country: string; lat: number; lng: number; eventCount: number; totalRegistrations: number }> {
  const locationMap = new Map<string, { name: string; city: string; country: string; lat: number; lng: number; eventCount: number; totalRegistrations: number }>();

  for (const event of events) {
    if (event.isOnline || !event.location.coordinates) continue;

    const key = event.location.city || event.location.country || 'Unknown';
    const existing = locationMap.get(key);

    if (existing) {
      existing.eventCount++;
      existing.totalRegistrations += event.registrations;
    } else {
      locationMap.set(key, {
        name: event.location.name,
        city: event.location.city || '',
        country: event.location.country || '',
        lat: event.location.coordinates.lat,
        lng: event.location.coordinates.lng,
        eventCount: 1,
        totalRegistrations: event.registrations,
      });
    }
  }

  return Array.from(locationMap.values()).sort((a, b) => b.eventCount - a.eventCount);
}

async function main() {
  console.log('Processing scraped Luma events data...\n');

  const historyDir = join(process.cwd(), 'public', 'data', 'history');
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }

  const events = processEvents();
  const now = new Date();

  // Split into upcoming and past
  const upcoming = events.filter(e => new Date(e.startDate) > now);
  const past = events.filter(e => new Date(e.startDate) <= now);

  // Sort
  upcoming.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  past.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  const inPersonEvents = events.filter(e => !e.isOnline);
  const onlineEvents = events.filter(e => e.isOnline);
  const countries = new Set(inPersonEvents.map(e => e.location.country).filter(Boolean));

  // Split past events for stats
  const pastInPerson = past.filter(e => !e.isOnline);
  const pastOnline = past.filter(e => e.isOnline);

  const dates = events
    .map(e => new Date(e.startDate))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const eventsData = {
    lastUpdated: new Date().toISOString(),
    upcoming,
    past,
    byMonth: groupByMonth(events),
    byCountry: groupByCountry(events),
    stats: {
      totalEvents: events.length,
      totalRegistrations: events.reduce((sum, e) => sum + e.registrations, 0),
      upcomingCount: upcoming.length,
      pastCount: past.length,
      countriesCount: countries.size,
      onlineCount: onlineEvents.length,
      inPersonCount: inPersonEvents.length,
      // Split stats for past events (for calculating averages)
      pastInPersonCount: pastInPerson.length,
      pastInPersonRegistrations: pastInPerson.reduce((sum, e) => sum + e.registrations, 0),
      pastOnlineCount: pastOnline.length,
      pastOnlineRegistrations: pastOnline.reduce((sum, e) => sum + e.registrations, 0),
      firstEventDate: dates.length > 0 ? dates[0].toISOString().split('T')[0] : '',
      lastEventDate: dates.length > 0 ? dates[dates.length - 1].toISOString().split('T')[0] : '',
    },
    locations: aggregateLocations(events),
  };

  const outputPath = join(historyDir, 'events.json');
  writeFileSync(outputPath, JSON.stringify(eventsData, null, 2));
  console.log(`Saved events data to ${outputPath}`);

  console.log('\n--- Summary ---');
  console.log(`Total events: ${eventsData.stats.totalEvents}`);
  console.log(`  Upcoming: ${eventsData.stats.upcomingCount}`);
  console.log(`  Past: ${eventsData.stats.pastCount}`);
  console.log(`  Online: ${eventsData.stats.onlineCount}`);
  console.log(`Countries: ${eventsData.stats.countriesCount}`);
  console.log(`Total registrations: ${eventsData.stats.totalRegistrations.toLocaleString()}`);
  console.log(`Date range: ${eventsData.stats.firstEventDate} to ${eventsData.stats.lastEventDate}`);
  console.log(`Locations with coordinates: ${eventsData.locations.length}`);
}

main().catch(console.error);
