# Claude Code Kickoff Prompt

Copy and paste this into Claude Code after you've created your project folder and added the starter files:

---

## PROMPT TO COPY:

```
I'm building a Morning Motivation PWA - a Progressive Web App that replaces morning scrolling with meaningful content. Read the CLAUDE.md file for full context.

Let's build this step by step. For the first phase, I want to:

1. Initialize a Next.js 14 project with TypeScript and Tailwind CSS
2. Set up the PWA configuration using next-pwa
3. Create the basic layout with dark theme
4. Build the main page that displays the current date
5. Create ONE working section first - the Quote of the Day (using the quotes.json file I've provided)

After we get the quote section working and looking good, we'll add the other sections one by one.

Requirements:
- Mobile-first design
- Dark theme (dark blue/gray background, orange accents)
- Clean, readable typography
- The app should work offline after first load (PWA caching)

Start by initializing the project and setting up the basic structure. Show me each step and explain what we're doing so I can learn.
```

---

## BEFORE YOU RUN THIS PROMPT:

1. Create a new folder for your project:
   ```bash
   mkdir morning-app
   cd morning-app
   ```

2. Copy the starter files into the folder:
   - `CLAUDE.md` → root of project
   - `data/quotes.json` → create `data` folder, put file inside
   - `data/saints.json` → same `data` folder
   - `public/manifest.json` → create `public` folder, put file inside

3. Open Claude Code in that directory:
   ```bash
   claude
   ```

4. Paste the prompt above

---

## AFTER PHASE 1 - NEXT PROMPTS:

Once the quote section is working, use these follow-up prompts:

### Phase 2 - Saints Section:
```
Now let's add the Saint of the Day section. Use the saints.json file I provided. The component should:
- Look up today's date (MM-DD format)
- Display the saint's name, type (memorial/feast/etc), and description
- Have a fallback for dates without a specific saint
- Match the styling of the quote card
```

### Phase 3 - Historical Events/Battles:
```
Add the Historical Battle section using Wikipedia's "On This Day" API:
https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/{MM}/{DD}

Filter the results to find military/battle events (look for keywords like "battle", "war", "siege", "military", "army", "troops", "invasion").
Display one battle per day, with the year and a brief description.
Include error handling and a loading state.
```

### Phase 4 - Art Section:
```
Add the Daily Art section using the Art Institute of Chicago API.
Create a curated list of artist IDs for: Salvador Dalí, Pablo Picasso, Vincent van Gogh, Claude Monet, Rembrandt.
Fetch a random artwork from one of these artists each day (rotate by day of year).
Display the artwork image, title, artist name, and date.
API docs: https://api.artic.edu/docs/
```

### Phase 5 - Gospel Reading:
```
Add the Daily Gospel section. Let's start with a static approach:
1. Create a lectionary.json mapping dates to gospel readings
2. Use bible-api.com to fetch the actual text
3. Display the reading reference and text

We can expand the lectionary data over time. Start with the current week's readings.
```

---

## HELPFUL COMMANDS:

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Check for errors
npm run lint

# Push to GitHub (after setting up repo)
git add .
git commit -m "your message"
git push
```
