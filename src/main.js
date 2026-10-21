import './styles/global.css';
import './styles/site.css';
import { initTimeline } from './timeline.js';
import { initActivity } from './activity.js';

const timeline = document.querySelector('[data-timeline]');
if (timeline) initTimeline(timeline);

const activity = document.querySelector('.activity');
if (activity) initActivity(activity);
