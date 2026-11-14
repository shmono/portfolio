const PAGE_TRANSITION_MAX_MS = 1600;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileLayout = window.matchMedia('(max-width: 1200px)');
const sectionTabs = [...document.querySelectorAll('.section-tab')];
const sectionPanels = [...document.querySelectorAll('.col-projects, .col-resume')];
const sectionTabsPill = document.querySelector('.t-tabs-pill');
const projectThumbs = [...document.querySelectorAll('.thumb')];
const projectItems = [...document.querySelectorAll('.project')];
const emailCopyButton = document.querySelector('.email-copy');
const copyToast = document.querySelector('.copy-toast');
const contactButtons = [...document.querySelectorAll('.pills .pill')];

let copyToastTimer = 0;
let copyToastAnimationFrame = 0;
let copyToastProgress = 0;
let copyToastVelocity = 0;
let copyToastTarget = 0;
let copyToastPreviousTime = 0;

const applyCopyToastFrame = (progress) => {
  if (!copyToast) return;

  const visibleProgress = Math.min(1, Math.max(0, progress));

  copyToast.style.opacity = String(visibleProgress);
  copyToast.style.transform = `translate(-50%, calc(-100% + ${(1 - visibleProgress) * 4}px))`;
};

const renderCopyToast = (time) => {
  if (!copyToast) return;

  const deltaTime = Math.min(Math.max((time - copyToastPreviousTime) / 1000, 0), 1 / 30);
  const { stiffness, damping, mass } = MOTION_SPRING.basic;
  copyToastPreviousTime = time;

  const springForce = -stiffness * (copyToastProgress - copyToastTarget);
  const dampingForce = -damping * copyToastVelocity;
  const acceleration = (springForce + dampingForce) / mass;

  copyToastVelocity += acceleration * deltaTime;
  copyToastProgress += copyToastVelocity * deltaTime;

  applyCopyToastFrame(copyToastProgress);

  const isSettled = Math.abs(copyToastTarget - copyToastProgress) < 0.001
    && Math.abs(copyToastVelocity) < 0.001;

  if (isSettled) {
    copyToastProgress = copyToastTarget;
    copyToastVelocity = 0;
    applyCopyToastFrame(copyToastTarget);
    copyToast.classList.toggle('is-visible', copyToastTarget === 1);
    copyToastAnimationFrame = 0;
    return;
  }

  copyToastAnimationFrame = requestAnimationFrame(renderCopyToast);
};

const setCopyToastVisible = (isVisible) => {
  if (!copyToast) return;

  copyToastTarget = isVisible ? 1 : 0;
  copyToast.classList.toggle('is-visible', isVisible);

  if (reduceMotion.matches) {
    if (copyToastAnimationFrame) cancelAnimationFrame(copyToastAnimationFrame);
    copyToastAnimationFrame = 0;
    copyToastProgress = copyToastTarget;
    copyToastVelocity = 0;
    applyCopyToastFrame(copyToastTarget);
    return;
  }

  if (!copyToastAnimationFrame) {
    copyToastPreviousTime = performance.now();
    copyToastAnimationFrame = requestAnimationFrame(renderCopyToast);
  }
};

const showCopyToast = () => {
  if (!copyToast || !emailCopyButton) return;

  copyToast.style.setProperty(
    '--toast-left',
    `${emailCopyButton.offsetLeft + emailCopyButton.offsetWidth / 2}px`,
  );
  copyToast.style.setProperty('--toast-top', `${emailCopyButton.offsetTop - 14}px`);

  window.clearTimeout(copyToastTimer);
  setCopyToastVisible(true);
  copyToastTimer = window.setTimeout(() => {
    setCopyToastVisible(false);
  }, 1600);
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.append(textArea);
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
  }
};

emailCopyButton?.addEventListener('click', async () => {
  await copyText(emailCopyButton.dataset.email || '');
  showCopyToast();
});

contactButtons.forEach((button) => {
  const clearPressedState = () => button.classList.remove('is-pressed');

  button.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') {
      button.classList.add('is-pressed');
    }
  });

  button.addEventListener('pointerup', clearPressedState);
  button.addEventListener('pointercancel', clearPressedState);
  button.addEventListener('pointerleave', clearPressedState);
});

/* ================= 공통 모션 토큰 ================= */
const MOTION_EASING = Object.freeze({
  ease: [0.6, 0, 0, 0.6],
  out: [0.25, 0.1, 0.25, 1],
  expo: [0.16, 1, 0.3, 1],
  back: [0.34, 1.56, 0.64, 1],
});

const MOTION_SPRING = Object.freeze({
  slow: Object.freeze({ stiffness: 70, damping: 20, mass: 1 }),
  basic: Object.freeze({ stiffness: 200, damping: 30, mass: 1 }),
  small: Object.freeze({ stiffness: 480, damping: 50, mass: 1 }),
  medium: Object.freeze({ stiffness: 270, damping: 25, mass: 1 }),
  large: Object.freeze({ stiffness: 100, damping: 15, mass: 1 }),
  quick: Object.freeze({ stiffness: 800, damping: 55, mass: 1 }),
  rapid: Object.freeze({ stiffness: 1000, damping: 55, mass: 1 }),
  bounce: Object.freeze({ stiffness: 300, damping: 15, mass: 1 }),
});

/* ================= 썸네일 이미지 커서 패럴랙스 ================= */
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const CURSOR_IMAGE_MAX_OFFSET = 7;
const CURSOR_IMAGE_SPRING = MOTION_SPRING.basic;

const setupCursorImageParallax = (thumb) => {
  const image = thumb.querySelector(':scope > img');
  if (!image) return null;

  const current = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  const velocity = { x: 0, y: 0 };
  let animationFrame = 0;
  let previousTime = performance.now();

  const render = (time) => {
    const deltaTime = Math.min(Math.max((time - previousTime) / 1000, 0), 1 / 30);
    const { stiffness, damping, mass } = CURSOR_IMAGE_SPRING;
    previousTime = time;

    const accelerationX = (-stiffness * (current.x - target.x) - damping * velocity.x) / mass;
    const accelerationY = (-stiffness * (current.y - target.y) - damping * velocity.y) / mass;

    velocity.x += accelerationX * deltaTime;
    velocity.y += accelerationY * deltaTime;
    current.x += velocity.x * deltaTime;
    current.y += velocity.y * deltaTime;

    image.style.setProperty('--cursor-image-x', `${current.x.toFixed(3)}px`);
    image.style.setProperty('--cursor-image-y', `${current.y.toFixed(3)}px`);

    const isSettled = Math.abs(target.x - current.x) < 0.01
      && Math.abs(target.y - current.y) < 0.01
      && Math.abs(velocity.x) < 0.01
      && Math.abs(velocity.y) < 0.01;

    if (isSettled) {
      current.x = target.x;
      current.y = target.y;
      velocity.x = 0;
      velocity.y = 0;
      image.style.setProperty('--cursor-image-x', `${target.x}px`);
      image.style.setProperty('--cursor-image-y', `${target.y}px`);
      animationFrame = 0;
      return;
    }

    animationFrame = requestAnimationFrame(render);
  };

  const requestRender = () => {
    if (!animationFrame) {
      previousTime = performance.now();
      animationFrame = requestAnimationFrame(render);
    }
  };

  const moveTo = (horizontalRatio, verticalRatio) => {
    target.x = horizontalRatio * CURSOR_IMAGE_MAX_OFFSET;
    target.y = verticalRatio * CURSOR_IMAGE_MAX_OFFSET;
    requestRender();
  };

  const reset = () => {
    target.x = 0;
    target.y = 0;
    requestRender();
  };

  return { moveTo, reset };
};

const cursorImageParallaxItems = projectThumbs
  .map(setupCursorImageParallax)
  .filter(Boolean);

/* 이미지 박스 밖에서도 화면 전체의 커서 위치를 기준으로 계속 움직입니다. */
window.addEventListener('pointermove', (event) => {
  if (!finePointer.matches || reduceMotion.matches) return;

  const horizontalRatio = (event.clientX / window.innerWidth) * 2 - 1;
  const verticalRatio = (event.clientY / window.innerHeight) * 2 - 1;

  cursorImageParallaxItems.forEach((item) => {
    item.moveTo(horizontalRatio, verticalRatio);
  });
});

document.documentElement.addEventListener('pointerleave', () => {
  cursorImageParallaxItems.forEach((item) => item.reset());
});

/* ================= 프로젝트 첫 진입 순차 등장 모션 ================= */
/* 이미지 박스 → 상세 페이지 확장에는 basic, 목록 등장에는 slow를 사용합니다. */
const SPRING_BASIC = MOTION_SPRING.basic;
const SPRING_SLOW = MOTION_SPRING.slow;
const PROJECT_REVEAL_STAGGER_MS = 100; /* 항목 사이의 순차 등장 간격 */
const PROJECT_REVEAL_OFFSET_PX = 40; /* 프로젝트가 올라오기 시작하는 아래쪽 거리 */
let shouldSkipProjectReveal = false;

const revealProjectWithSpring = (project, delay) => {
  const { stiffness, damping, mass } = SPRING_SLOW;
  const startsAt = performance.now() + delay;
  let previousTime = startsAt;
  let opacity = 0;
  let velocity = 0;

  const update = (time) => {
    if (shouldSkipProjectReveal) {
      project.style.opacity = '';
      project.style.transform = '';
      project.classList.remove('is-entering');
      return;
    }

    if (time < startsAt) {
      requestAnimationFrame(update);
      return;
    }

    /* 긴 프레임 이후 값이 튀지 않도록 한 프레임의 계산 시간을 제한합니다. */
    const deltaTime = Math.min(Math.max((time - previousTime) / 1000, 0), 1 / 30);
    previousTime = time;

    const springForce = -stiffness * (opacity - 1);
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;

    velocity += acceleration * deltaTime;
    opacity += velocity * deltaTime;
    const progress = Math.min(1, Math.max(0, opacity));
    project.style.opacity = String(progress);
    project.style.transform = `translateY(${(1 - progress) * PROJECT_REVEAL_OFFSET_PX}px)`;

    if (Math.abs(1 - opacity) > 0.001 || Math.abs(velocity) > 0.001) {
      requestAnimationFrame(update);
      return;
    }

    project.style.opacity = '';
    project.style.transform = '';
    project.classList.remove('is-entering');
  };

  requestAnimationFrame(update);
};

if (projectItems.length && !reduceMotion.matches) {
  /* 첫 프레임에는 모든 항목을 투명하게 고정한 뒤 위에서부터 시작합니다. */
  projectItems.forEach((project) => project.classList.add('is-entering'));

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      projectItems.forEach((project, index) => {
        revealProjectWithSpring(project, index * PROJECT_REVEAL_STAGGER_MS);
      });
    });
  });
}

/* 상세 페이지에서 브라우저 뒤로가기로 복원될 때 숨겨진 전환 상태를 즉시 정리합니다. */
const resetMainPageAfterTransition = () => {
  const mainPage = document.querySelector('.app');

  shouldSkipProjectReveal = true;
  document.body.classList.remove('is-page-leaving');
  document.querySelectorAll('.page-transition-detail, .page-transition').forEach((layer) => layer.remove());

  if (mainPage) {
    mainPage.style.opacity = '';
    mainPage.style.transform = '';
  }

  projectItems.forEach((project) => {
    project.classList.remove('is-entering');
    project.style.opacity = '';
    project.style.transform = '';
  });
};

window.addEventListener('pageshow', (event) => {
  const isReturningFromProject = sessionStorage.getItem('project-returning-to-main') === 'true';

  if (!event.persisted && !isReturningFromProject) return;

  sessionStorage.removeItem('project-returning-to-main');
  resetMainPageAfterTransition();
});

const moveSectionTabsPill = (tab, animate = true) => {
  if (!sectionTabsPill || !tab) return;

  if (!animate) {
    const previousTransition = sectionTabsPill.style.transition;
    sectionTabsPill.style.transition = 'none';
    sectionTabsPill.style.transform = `translateX(${tab.offsetLeft}px)`;
    sectionTabsPill.style.width = `${tab.offsetWidth}px`;
    void sectionTabsPill.offsetWidth;
    sectionTabsPill.style.transition = previousTransition;
    return;
  }

  sectionTabsPill.style.transform = `translateX(${tab.offsetLeft}px)`;
  sectionTabsPill.style.width = `${tab.offsetWidth}px`;
};

const activateSection = (tab, animatePill = true) => {
  const panelId = tab.dataset.tab;

  sectionTabs.forEach((item) => {
    const isActive = item === tab;
    item.classList.toggle('is-active', isActive);
    item.setAttribute('aria-selected', String(isActive));
    item.tabIndex = isActive ? 0 : -1;
  });

  sectionPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.id === panelId);
  });

  moveSectionTabsPill(tab, animatePill);

  if (mobileLayout.matches) {
    window.scrollTo(0, 0);
  }
};

sectionTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateSection(tab));

  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    let nextIndex = index;

    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + sectionTabs.length) % sectionTabs.length;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % sectionTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = sectionTabs.length - 1;

    sectionTabs[nextIndex].focus();
    activateSection(sectionTabs[nextIndex]);
  });
});

const projectsTab = sectionTabs.find((tab) => tab.dataset.tab === 'projects-panel');
const activeSectionTab = () => sectionTabs.find((tab) => tab.getAttribute('aria-selected') === 'true');

requestAnimationFrame(() => {
  moveSectionTabsPill(activeSectionTab(), false);
});

window.addEventListener('resize', () => {
  moveSectionTabsPill(activeSectionTab(), false);
});

/* 데스크톱에서 태블릿/모바일 크기로 진입할 때마다 Projects를 첫 화면으로 표시 */
mobileLayout.addEventListener('change', (event) => {
  if (event.matches && projectsTab) {
    activateSection(projectsTab, false);
  }
});

const projectDetailPage = document.querySelector('.project-detail-page');

const revealDetailItemWithSpring = (element, delay = 0, onComplete = () => {}) => {
  const startsAt = performance.now() + delay;
  const { stiffness, damping, mass } = SPRING_BASIC;
  let previousTime = startsAt;
  let progress = 0;
  let velocity = 0;

  const update = (time) => {
    if (time < startsAt) {
      requestAnimationFrame(update);
      return;
    }

    const deltaTime = Math.min(Math.max((time - previousTime) / 1000, 0), 1 / 30);
    previousTime = time;

    const springForce = -stiffness * (progress - 1);
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;

    velocity += acceleration * deltaTime;
    progress += velocity * deltaTime;

    const visibleProgress = Math.min(1, Math.max(0, progress));
    element.style.opacity = String(visibleProgress);
    element.style.transform = `translateY(${(1 - visibleProgress) * 12}px)`;

    if (Math.abs(1 - progress) > 0.001 || Math.abs(velocity) > 0.001) {
      requestAnimationFrame(update);
      return;
    }

    element.classList.add('is-visible');
    element.style.opacity = '';
    element.style.transform = '';
    onComplete();
  };

  requestAnimationFrame(update);
};

/* ================= 프로젝트 상세 페이지 등장 모션 ================= */
if (projectDetailPage) {
  const revealSections = [...document.querySelectorAll('.case-reveal')];
  const firstCaseSection = document.querySelector('.case-study-content > .case-section:first-child');
  const sequenceItems = [
    document.querySelector('.case-study-heading'),
    document.querySelector('.case-study-meta'),
    firstCaseSection?.querySelector('.case-image-placeholder'),
    firstCaseSection?.querySelector('.case-section-copy'),
  ].filter(Boolean);
  let hasStartedSequence = false;
  let hasStartedScrollReveal = false;

  projectDetailPage.classList.add('is-ready');
  sequenceItems.forEach((item) => item.classList.add('detail-sequence-item'));

  const beginScrollReveal = () => {
    if (hasStartedScrollReveal) return;
    hasStartedScrollReveal = true;

    if ('IntersectionObserver' in window && !reduceMotion.matches) {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealObserver.unobserve(entry.target);
          revealDetailItemWithSpring(entry.target);
        });
      }, { threshold: 0.08 });

      revealSections.forEach((section) => revealObserver.observe(section));
    } else {
      revealSections.forEach((section) => section.classList.add('is-visible'));
    }
  };

  const finishSequence = () => {
    beginScrollReveal();
  };

  const startSequence = () => {
    if (hasStartedSequence) return;
    hasStartedSequence = true;

    if (reduceMotion.matches || !sequenceItems.length) {
      sequenceItems.forEach((item) => item.classList.add('is-visible'));
      finishSequence();
      return;
    }

    sequenceItems.forEach((item, index) => {
      const isLastItem = index === sequenceItems.length - 1;
      revealDetailItemWithSpring(item, index * 120, isLastItem ? finishSequence : undefined);
    });
  };

  requestAnimationFrame(() => requestAnimationFrame(startSequence));
}

const compileRippleShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

/* 박스는 고정하고, WebGL의 연속 UV 좌표에서 내부 이미지만 부드럽게 일렁임 */
const playContentRipple = (thumb, event, onComplete) => {
  const image = thumb.querySelector('img');

  if (!image || !image.complete || !image.naturalWidth) {
    onComplete();
    return;
  }

  const rect = thumb.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const clickX = event.detail === 0 ? width / 2 : event.clientX - rect.left;
  const clickY = event.detail === 0 ? height / 2 : event.clientY - rect.top;
  const canvas = document.createElement('canvas');
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });

  if (!gl) {
    onComplete();
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision highp float;

    uniform sampler2D u_texture;
    uniform vec2 u_center;
    uniform vec2 u_uv_scale;
    uniform vec2 u_uv_offset;
    uniform float u_aspect;
    uniform float u_progress;
    varying vec2 v_uv;

    void main() {
      vec2 delta = v_uv - u_center;
      delta.x *= u_aspect;
      float distanceFromClick = length(delta);
      vec2 direction = distanceFromClick > 0.0001 ? delta / distanceFromClick : vec2(0.0);
      direction.x /= u_aspect;

      float waveFront = u_progress * 1.5;
      float distanceToWave = distanceFromClick - waveFront;
      float waveBand = exp(-pow(distanceToWave * 12.0, 2.0));
      float oscillation = sin(distanceToWave * 42.0);
      float remaining = 1.0 - u_progress;
      vec2 displacement = direction * oscillation * waveBand * remaining * 0.014;
      vec2 displacedUv = clamp(v_uv + displacement, 0.0, 1.0);
      vec2 textureUv = u_uv_offset + (displacedUv * u_uv_scale);
      vec4 color = texture2D(u_texture, textureUv);

      float whiteLight = waveBand * remaining * 0.08;
      color.rgb = 1.0 - ((1.0 - color.rgb) * (1.0 - whiteLight));
      gl_FragColor = color;
    }
  `;
  const vertexShader = compileRippleShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileRippleShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) {
    onComplete();
    return;
  }

  const program = gl.createProgram();
  if (!program) {
    onComplete();
    return;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    onComplete();
    return;
  }

  canvas.className = 'thumb-content-ripple-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  thumb.classList.add('is-content-rippling');
  thumb.append(canvas);

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  } catch (error) {
    canvas.remove();
    thumb.classList.remove('is-content-rippling');
    onComplete();
    return;
  }

  const destinationAspect = width / height;
  const sourceAspect = image.naturalWidth / image.naturalHeight;
  let uvScaleX = 1;
  let uvScaleY = 1;
  let uvOffsetX = 0;
  let uvOffsetY = 0;

  /* CSS object-fit: cover와 같은 범위를 텍스처에서 샘플링 */
  if (sourceAspect > destinationAspect) {
    uvScaleX = destinationAspect / sourceAspect;
    uvOffsetX = (1 - uvScaleX) / 2;
  } else {
    uvScaleY = sourceAspect / destinationAspect;
    uvOffsetY = (1 - uvScaleY) / 2;
  }

  gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);
  gl.uniform2f(
    gl.getUniformLocation(program, 'u_center'),
    Math.min(1, Math.max(0, clickX / width)),
    1 - Math.min(1, Math.max(0, clickY / height)),
  );
  gl.uniform2f(gl.getUniformLocation(program, 'u_uv_scale'), uvScaleX, uvScaleY);
  gl.uniform2f(gl.getUniformLocation(program, 'u_uv_offset'), uvOffsetX, uvOffsetY);
  gl.uniform1f(gl.getUniformLocation(program, 'u_aspect'), width / height);

  const progressLocation = gl.getUniformLocation(program, 'u_progress');
  const duration = 720;
  const startedAt = performance.now();

  const finish = () => {
    canvas.remove();
    thumb.classList.remove('is-content-rippling');
    gl.deleteTexture(texture);
    gl.deleteBuffer(positionBuffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    onComplete();
  };

  const drawFrame = (time) => {
    const progress = Math.min((time - startedAt) / duration, 1);
    gl.uniform1f(progressLocation, progress);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (progress < 1) {
      requestAnimationFrame(drawFrame);
    } else {
      finish();
    }
  };

  /* 클릭 순간 첫 frame을 즉시 렌더링 */
  drawFrame(startedAt);
};

const startProjectPageTransition = (project) => {
  const destination = project.href;
  const currentPage = document.querySelector('.app');
  const TRANSITION_TIMEOUT_MS = 2000;
  let hasNavigated = false;

  if (!currentPage) {
    window.location.href = destination;
    return;
  }

  const navigate = () => {
    if (hasNavigated) return;
    hasNavigated = true;

    /* 새 문서가 표시될 때까지 기존 화면을 opacity 0으로 유지해 순간 노출을 막습니다. */
    window.location.href = destination;
  };

  const stepSpring = (state, spring, deltaTime) => {
    const springForce = -spring.stiffness * (state.value - 1);
    const dampingForce = -spring.damping * state.velocity;
    const acceleration = (springForce + dampingForce) / spring.mass;

    state.velocity += acceleration * deltaTime;
    state.value += state.velocity * deltaTime;
  };

  document.body.classList.add('is-page-leaving');

  const startedAt = performance.now();
  const oldPage = { value: 0, velocity: 0 };
  let previousTime = startedAt;

  const renderPageTransition = (time) => {
    const deltaTime = Math.min(Math.max((time - previousTime) / 1000, 0), 1 / 30);
    previousTime = time;

    stepSpring(oldPage, SPRING_SLOW, deltaTime);

    const oldProgress = Math.min(1, Math.max(0, oldPage.value));
    /* spring slow 시작 후 약 1.2초에 실제 상세 페이지로 한 번만 이동합니다. */
    const oldSettled = oldProgress >= 0.993;

    currentPage.style.opacity = String(1 - oldProgress);
    currentPage.style.transform = `translateZ(0) scale(${1 - oldProgress * 0.06})`;

    if (!oldSettled) {
      requestAnimationFrame(renderPageTransition);
      return;
    }

    currentPage.style.opacity = '0';
    currentPage.style.transform = 'translateZ(0) scale(0.94)';
    requestAnimationFrame(navigate);
  };

  requestAnimationFrame(renderPageTransition);
  window.setTimeout(navigate, TRANSITION_TIMEOUT_MS);
};

projectItems.forEach((project) => {
  const clearPressedState = () => project.classList.remove('is-pressed');

  project.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') {
      project.classList.add('is-pressed');
    }
  });

  project.addEventListener('pointerup', clearPressedState);
  project.addEventListener('pointercancel', clearPressedState);
  project.addEventListener('pointerleave', clearPressedState);

  project.addEventListener('click', (event) => {
    const isModifiedClick = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

    if (isModifiedClick || event.button !== 0 || reduceMotion.matches) return;

    event.preventDefault();

    if (document.body.classList.contains('is-page-leaving')) return;

    startProjectPageTransition(project);
  });
});

const backButton = document.querySelector('.back-button');

if (backButton) {
  backButton.addEventListener('click', (event) => {
    const cameFromMainPage = document.referrer.startsWith(window.location.origin)
      && document.referrer.includes('index.html');

    if (cameFromMainPage) {
      event.preventDefault();
      sessionStorage.setItem('project-returning-to-main', 'true');
      window.history.back();
    }
  });
}
