---
layout: default
title: Writing
description: Writing by Austin McGaugh.
permalink: /writing/
---
<section class="page-hero section-wrap writing-page-hero">
  <h1>Writing</h1>
  <p class="page-intro">Articles and notes on software engineering and game development.</p>
</section>

<section class="section-wrap post-list-section">
  {% assign writing_posts = site.posts | sort: "date" | reverse %}
  {% if writing_posts.size > 0 %}
    <div class="post-list">
      {% for post in writing_posts %}
        <a class="post-list-item" href="{{ post.url | relative_url }}">
          <time class="post-date" datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %Y" }}</time>
          <div class="post-list-copy">
            <h2>{{ post.title | escape }}</h2>
            {% if post.description %}<p>{{ post.description | escape }}</p>{% endif %}
          </div>
          <span class="post-list-arrow" aria-hidden="true">↗</span>
        </a>
      {% endfor %}
    </div>
  {% else %}
    <div class="empty-writing">
      <h2>No posts yet.</h2>
      <p>Published posts will appear here.</p>
    </div>
  {% endif %}
</section>
