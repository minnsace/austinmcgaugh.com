---
layout: default
title: Writing
description: Notes and ideas from Austin McGaugh.
permalink: /writing/
---
<section class="page-hero section-wrap writing-page-hero">
  <p class="eyebrow">Notes & ideas / 02</p>
  <h1>The writing desk.</h1>
  <p class="page-intro">A place for thoughts in progress, lessons from making, and ideas worth working through.</p>
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
      <span class="empty-mark" aria-hidden="true">✳</span>
      <p class="eyebrow">First note, when it’s ready</p>
      <h2>No posts just yet.</h2>
      <p>I’m keeping this space open for writing worth sharing. Check back soon.</p>
    </div>
  {% endif %}
</section>
