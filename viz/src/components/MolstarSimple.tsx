import React, { useEffect, useRef } from 'react';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';
import { PluginContext } from 'molstar/lib/mol-plugin/context';

interface MolstarViewerProps {
  cifData: File | string; // Accepts either a File object or a URL string
  width?: string;
  height?: string;
  className?: string;
}

const MolstarSimple: React.FC<MolstarViewerProps> = ({ 
  cifData, 
  width = '800px', 
  height = '600px',
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<PluginContext | null>(null);

  const initViewer = async (element: HTMLDivElement) => {
    const canvas = document.createElement('canvas');
    element.appendChild(canvas);

    const spec = DefaultPluginSpec();
    const plugin = new PluginContext(spec);
    await plugin.init();
    plugin.initViewer(canvas, element);
    return plugin;
  };

  const loadStructure = async (plugin: PluginContext, data: File | string) => {
    try {
      let structureData;
      
      if (typeof data === 'string') {
        // If data is a URL
        structureData = await plugin.builders.data.download({ 
          url: data,
          isBinary: data.endsWith('.bcif') // Check if it's a binary CIF file
        });
      } else {
        // If data is a File object
        const arrayBuffer = await data.arrayBuffer();
        structureData = await plugin.builders.data.rawData({ 
          data: arrayBuffer,
        });
      }

      const trajectory = await plugin.builders.structure.parseTrajectory(
        structureData,
        'mmcif'
      );
      
      const preset = await plugin.builders.structure.hierarchy.applyPreset(
        trajectory,
        'default'
      );

      return preset;
    } catch (error) {
      console.error('Error loading structure:', error);
      throw error;
    }
  };

  useEffect(() => {
    const setupViewer = async () => {
      if (!containerRef.current) return;

      try {
        // Initialize viewer if it doesn't exist
        if (!pluginRef.current) {
          pluginRef.current = await initViewer(containerRef.current);
        }

        // Load the structure
        await loadStructure(pluginRef.current, cifData);
      } catch (error) {
        console.error('Error setting up viewer:', error);
      }
    };

    setupViewer();

    // Cleanup function
    return () => {
      if (pluginRef.current) {
        pluginRef.current.dispose();
        pluginRef.current = null;
      }
    };
  }, [cifData]); // Re-run when cifData changes

  return (
    <div 
      ref={containerRef}
      style={{ 
        width, 
        height,
        position: 'relative' 
      }}
      className={className}
    />
  );
};

export default MolstarSimple;