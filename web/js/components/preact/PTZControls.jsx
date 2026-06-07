/**
 * PTZ Controls Component
 * Pan-Tilt-Zoom controls for PTZ-enabled cameras
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { useI18n } from '../../i18n.js';

/**
 * PTZ API functions
 */
const ptzApi = {
  async move(streamName, pan, tilt, zoom) {
    const response = await fetch(`/api/streams/${encodeURIComponent(streamName)}/ptz/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pan, tilt, zoom })
    });
    if (!response.ok) throw new Error('Failed to move');
    return response.json();
  },

  async stop(streamName) {
    const response = await fetch(
      `/api/streams/${encodeURIComponent(streamName)}/ptz/stop`,
      {
        method: 'POST'
      }
    );

    return response.json();
  },

  async home(streamName) {
    const response = await fetch(
      `/api/streams/${encodeURIComponent(streamName)}/ptz/home`,
      {
        method: 'POST'
      }
    );

    return response.json();
  },

  async getPresets(streamName) {
    const response = await fetch(
      `/api/streams/${encodeURIComponent(streamName)}/ptz/presets`
    );

    return response.json();
  },

  async gotoPreset(streamName, token) {
    const response = await fetch(
      `/api/streams/${encodeURIComponent(streamName)}/ptz/preset`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      }
    );

    return response.json();
  },

  async getCapabilities(streamName) {
    const response = await fetch(
      `/api/streams/${encodeURIComponent(streamName)}/ptz/capabilities`
    );

    return response.json();
  }
};

/**
 * Direction button component
 */
function DirectionButton({
  direction,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  disabled
}) {

  const icons = {
    up: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M12 5L5 14H19L12 5Z" />
      </svg>
    ),

    down: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M12 19L5 10H19L12 19Z" />
      </svg>
    ),

    left: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M5 12L14 5V19L5 12Z" />
      </svg>
    ),

    right: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M19 12L10 5V19L19 12Z" />
      </svg>
    ),

    'zoom-in': (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
    ),

    'zoom-out': (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
    )
  };

  return (
    <button
      className={`ptz-btn ptz-btn-${direction}`}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onMouseDown}
      onTouchEnd={onMouseUp}
      onTouchCancel={onMouseUp}
      disabled={disabled}
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: 'none',
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        color: 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none'
      }}
    >
      {icons[direction]}
    </button>
  );
}

/**
 * PTZ Controls component
 */
export function PTZControls({
  stream,
  isVisible = true,
  onClose
}) {

  const { t } = useI18n();

  const [speed, setSpeed] = useState(0.5);
  const [presets, setPresets] = useState([]);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState(null);

  // =========================
  // DRAG STATE
  // =========================
  const panelRef = useRef(null);

  const [position, setPosition] = useState({
    x: 10,
    y: 65
  });

  const dragData = useRef({
    dragging: false,
    offsetX: 0,
    offsetY: 0
  });

  // =========================
  // LOAD PRESETS
  // =========================
  useEffect(() => {
    if (!stream?.name || !stream?.ptz_enabled) return;

    ptzApi.getPresets(stream.name)
      .then(data => setPresets(data.presets || []))
      .catch(err =>
        console.error('Failed to get PTZ presets:', err)
      );
  }, [stream?.name, stream?.ptz_enabled]);

  // =========================
  // DRAG FUNCTIONS
  // =========================
  const clampPosition = useCallback((x, y) => {

    const panel = panelRef.current;

    if (!panel) return { x, y };

    const parent = panel.parentElement;

    if (!parent) return { x, y };

    const parentRect = parent.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    const maxX = parentRect.width - panelRect.width;
    const maxY = parentRect.height - panelRect.height;

    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY))
    };

  }, []);

  const startDrag = useCallback((e) => {

    const panel = panelRef.current;

    if (!panel) return;

    dragData.current.dragging = true;

    const clientX = e.touches
      ? e.touches[0].clientX
      : e.clientX;

    const clientY = e.touches
      ? e.touches[0].clientY
      : e.clientY;

    dragData.current.offsetX =
      clientX + position.x;

    dragData.current.offsetY =
      clientY + position.y;

    e.preventDefault();

  }, [position]);

  const onDrag = useCallback((e) => {

    if (!dragData.current.dragging) return;

    const clientX = e.touches
      ? e.touches[0].clientX
      : e.clientX;

    const clientY = e.touches
      ? e.touches[0].clientY
      : e.clientY;

    let newX =
      dragData.current.offsetX - clientX;

    let newY =
      dragData.current.offsetY - clientY;

    const clamped =
      clampPosition(newX, newY);

    setPosition(clamped);

  }, [clampPosition]);

  const stopDrag = useCallback(() => {
    dragData.current.dragging = false;
  }, []);

  useEffect(() => {

    window.addEventListener(
      'mousemove',
      onDrag
    );

    window.addEventListener(
      'mouseup',
      stopDrag
    );

    window.addEventListener(
      'touchmove',
      onDrag,
      { passive: false }
    );

    window.addEventListener(
      'touchend',
      stopDrag
    );

    return () => {

      window.removeEventListener(
        'mousemove',
        onDrag
      );

      window.removeEventListener(
        'mouseup',
        stopDrag
      );

      window.removeEventListener(
        'touchmove',
        onDrag
      );

      window.removeEventListener(
        'touchend',
        stopDrag
      );

    };

  }, [onDrag, stopDrag]);

  // =========================
  // PTZ FUNCTIONS
  // =========================
  const handleMoveStart = useCallback(
    (pan, tilt, zoom) => {

      if (!stream?.name) return;

      setIsMoving(true);
      setError(null);

      ptzApi.move(
        stream.name,
        pan * speed,
        tilt * speed,
        zoom * speed
      ).catch(err => {

        setIsMoving(false);

        setError(
          t('live.ptzMoveFailed')
        );

        console.error(
          'PTZ move error:',
          err
        );

      });

    },
    [stream?.name, speed, t]
  );

  const handleMoveStop = useCallback(() => {
  
    if (!stream?.name)
      return;
  
    setIsMoving(false);
  
    ptzApi.stop(stream.name)
      .catch(err =>
        console.error(
          'PTZ stop error:',
          err
        )
      );
  
  }, [stream?.name]);

  const handleHome = useCallback(() => {

    if (!stream?.name) return;

    setError(null);

    ptzApi.home(stream.name)
      .catch(err => {

        setError(
          t('live.ptzHomeFailed')
        );

        console.error(
          'PTZ home error:',
          err
        );

      });

  }, [stream?.name, t]);

  const handlePreset = useCallback((token) => {

    if (!stream?.name) return;

    setError(null);

    ptzApi.gotoPreset(
      stream.name,
      token
    ).catch(err => {

      setError(
        t('live.ptzPresetFailed')
      );

      console.error(
        'PTZ preset error:',
        err
      );

    });

  }, [stream?.name, t]);

  if (
    !isVisible ||
    !stream?.ptz_enabled
  ) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="ptz-controls"
      style={{
        position: 'absolute',
        right: `${position.x}px`,
        bottom: `${position.y}px`,
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        borderRadius: '8px',
        padding: '12px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '160px',
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: 'auto'
      }}
    >

      {/* HEADER DRAG */}
      <div
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
          cursor: 'move',
          padding: '4px',
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: '6px'
        }}
      >

        <span
          style={{
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          {t('live.ptzControl')}
        </span>

        {onClose && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation',
              zIndex: 9999
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

      </div>

      {/* Direction pad */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(3, 40px)',
          gap: '4px',
          justifyContent: 'center'
        }}
      >

        <div></div>

        <DirectionButton
          direction="up"
          onMouseDown={() =>
            handleMoveStart(0, 1, 0)
          }
          onMouseUp={handleMoveStop}
          onMouseLeave={handleMoveStop}
        />

        <div></div>

        <DirectionButton
          direction="left"
          onMouseDown={() =>
            handleMoveStart(-1, 0, 0)
          }
          onMouseUp={handleMoveStop}
          onMouseLeave={handleMoveStop}
        />

        {/* HOME BUTTON */}
        <button
          onClick={handleHome}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor:
              'rgba(107, 114, 128, 0.8)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={t('live.goToHomePosition')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="white"
          >
            <path d="M12 3L3 10H6V21H10V15H14V21H18V10H21L12 3Z" />
          </svg>
        </button>

        <DirectionButton
          direction="right"
          onMouseDown={() =>
            handleMoveStart(1, 0, 0)
          }
          onMouseUp={handleMoveStop}
          onMouseLeave={handleMoveStop}
        />

        <div></div>

        <DirectionButton
          direction="down"
          onMouseDown={() =>
            handleMoveStart(0, -1, 0)
          }
          onMouseUp={handleMoveStop}
          onMouseLeave={handleMoveStop}
        />

        <div></div>

      </div>

      {/* Zoom controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '4px'
        }}
      >

        <DirectionButton
          direction="zoom-out"
          onMouseDown={() =>
            handleMoveStart(0, 0, -1)
          }
          onMouseUp={handleMoveStop}
          onMouseLeave={handleMoveStop}
        />

        <span
          style={{
            color: 'white',
            fontSize: '11px',
            alignSelf: 'center'
          }}
        >
          {t('live.zoom')}
        </span>

        <DirectionButton
          direction="zoom-in"
          onMouseDown={() =>
            handleMoveStart(0, 0, 1)
          }
          onMouseUp={handleMoveStop}
          onMouseLeave={handleMoveStop}
        />

      </div>

      {/* Speed slider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '4px'
        }}
      >

        <span
          style={{
            color: 'white',
            fontSize: '11px'
          }}
        >
          {t('live.speedLabel')}
        </span>

        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={speed}
          onChange={(e) =>
            setSpeed(
              parseFloat(e.target.value)
            )
          }
          style={{ flex: 1 }}
        />

        <span
          style={{
            color: 'white',
            fontSize: '11px',
            width: '30px'
          }}
        >
          {Math.round(speed * 100)}%
        </span>

      </div>

      {/* Presets */}
      {presets.length > 0 && (
        <div style={{ marginTop: '4px' }}>
          <select
            onChange={(e) =>
              e.target.value &&
              handlePreset(e.target.value)
            }
            style={{
              width: '100%',
              padding: '6px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor:
                'rgba(59, 130, 246, 0.8)',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <option value="">
              {t('live.goToPreset')}
            </option>

            {presets.map(preset => (
              <option
                key={preset.token}
                value={preset.token}
              >
                {preset.name ||
                  t(
                    'live.presetNumber',
                    {
                      token: preset.token
                    }
                  )}
              </option>
            ))}

          </select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            color: '#ef4444',
            fontSize: '11px',
            textAlign: 'center'
          }}
        >
          {error}
        </div>
      )}

    </div>
  );
}
