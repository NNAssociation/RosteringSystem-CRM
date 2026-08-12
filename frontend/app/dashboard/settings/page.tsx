"use client";

import React, { useState, useEffect } from "react";
import { useHeader } from "@/providers/header-provider";
import { 
  useGetDepotsQuery, 
  useCreateDepotMutation, 
  useUpdateDepotMutation, 
  useDeleteDepotMutation,
  useGetSchedulingSettingsQuery,
  useUpdateSchedulingSettingsMutation,
  Depot,
  SchedulingSettings
} from "@/services/api";
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { Add, Edit, Delete } from "@mui/icons-material";
import { GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
import { useGoogleMaps } from "@/providers/google-maps-provider";

export default function SettingsPage() {
  const { setHeaderConfig } = useHeader();
  const { data: depots, isLoading, refetch } = useGetDepotsQuery();
  const [createDepot] = useCreateDepotMutation();
  const [updateDepot] = useUpdateDepotMutation();
  const [deleteDepot] = useDeleteDepotMutation();

  const { data: schedulingSettings, isLoading: isLoadingSettings } = useGetSchedulingSettingsQuery();
  const [updateSchedulingSettings, { isLoading: isUpdatingSettings }] = useUpdateSchedulingSettingsMutation();

  const [schedulingForm, setSchedulingForm] = useState({
    maxContinuousDrivingHours: '5.5',
    minBreakDurationMinutes: '30',
    maxShiftDurationHours: '12',
    bufferMinutes: '10',
    depotTravelBuffer: '10',
    transitTimeMinutes: '60'
  });

  useEffect(() => {
    if (schedulingSettings) {
      setSchedulingForm({
        maxContinuousDrivingHours: (parseInt(schedulingSettings.maxContinuousDrivingMinutes || '330') / 60).toString(),
        minBreakDurationMinutes: schedulingSettings.minBreakDurationMinutes || '30',
        maxShiftDurationHours: (parseInt(schedulingSettings.maxShiftDurationMinutes || '720') / 60).toString(),
        bufferMinutes: schedulingSettings.bufferMinutes || '10',
        depotTravelBuffer: schedulingSettings.depotTravelBuffer || '10',
        transitTimeMinutes: schedulingSettings.transitTimeMinutes || '60'
      });
    }
  }, [schedulingSettings]);

  const handleSaveScheduling = async () => {
    try {
      await updateSchedulingSettings({
        maxContinuousDrivingMinutes: (parseFloat(schedulingForm.maxContinuousDrivingHours) * 60).toString(),
        minBreakDurationMinutes: schedulingForm.minBreakDurationMinutes,
        maxShiftDurationMinutes: (parseFloat(schedulingForm.maxShiftDurationHours) * 60).toString(),
        bufferMinutes: schedulingForm.bufferMinutes,
        depotTravelBuffer: schedulingForm.depotTravelBuffer,
        transitTimeMinutes: schedulingForm.transitTimeMinutes
      }).unwrap();
      toast.success("Scheduling rules saved successfully");
    } catch (error: any) {
      toast.error(error.data?.error || "Failed to save scheduling rules");
    }
  };

  const { isLoaded } = useGoogleMaps();

  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const onLoad = React.useCallback((ac: google.maps.places.Autocomplete) => {
    setAutocomplete(ac);
  }, []);

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        setFormData(prev => ({
          ...prev,
          lat: place.geometry!.location!.lat().toString(),
          lng: place.geometry!.location!.lng().toString(),
          name: prev.name || place.name || '',
          address: place.formatted_address || place.name || ''
        }));
      }
    }
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepot, setEditingDepot] = useState<Depot | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lat: '',
    lng: ''
  });

  useEffect(() => {
    setHeaderConfig({ title: "Settings" });
  }, [setHeaderConfig]);

  const resetForm = () => {
    setFormData({ name: '', address: '', lat: '', lng: '' });
    setEditingDepot(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (depot: Depot) => {
    setFormData({
      name: depot.name,
      address: depot.address || '',
      lat: depot.lat.toString(),
      lng: depot.lng.toString()
    });
    setEditingDepot(depot);
    setIsDialogOpen(true);
  };

  const onMapClick = React.useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setFormData(prev => ({
        ...prev,
        lat: e.latLng!.lat().toString(),
        lng: e.latLng!.lng().toString()
      }));
    }
  }, []);

  const mapCenter = React.useMemo(() => {
    const lat = parseFloat(formData.lat);
    const lng = parseFloat(formData.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
    return { lat: -33.8688, lng: 151.2093 };
  }, [formData.lat, formData.lng]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lat || !formData.lng || isNaN(parseFloat(formData.lat))) {
      toast.error("Please search for a location or drop a pin on the map.");
      return;
    }
    try {
      if (editingDepot) {
        await updateDepot({
          id: editingDepot.id,
          name: formData.name,
          address: formData.address,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng)
        }).unwrap();
        toast.success("Depot updated successfully");
      } else {
        await createDepot({
          name: formData.name,
          address: formData.address,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng)
        }).unwrap();
        toast.success("Depot created successfully");
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.data?.error || "Failed to save depot");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this depot?")) {
      try {
        await deleteDepot(id).unwrap();
        toast.success("Depot deleted successfully");
      } catch (error: any) {
        toast.error(error.data?.error || "Failed to delete depot");
      }
    }
  };

  if (isLoading || isLoadingSettings) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="p-8 h-[calc(100vh-64px)] overflow-auto bg-slate-50/50">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Depot Locations</h1>
            <p className="text-sm text-slate-500 mt-1">Manage physical depot locations where drivers and buses are stationed.</p>
          </div>
          
          <DialogBox
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.pac-container')) {
                e.preventDefault();
              }
            }}
            modal={false}
            title={editingDepot ? "Edit Depot" : "Add New Depot"}
            trigger={
              <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90 text-white shadow-md rounded-xl px-6 h-11">
                <Add className="mr-2" style={{ fontSize: 20 }} />
                Add Depot
              </Button>
            }
          >
            <form onSubmit={handleSubmit} className="space-y-4 p-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Depot Name</label>
                <Input
                  required
                  placeholder="e.g. Parramatta Depot"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Search Location</label>
                {isLoaded ? (
                  <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
                    <input 
                      type="text"
                      placeholder="Type to search for an address or place..." 
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.preventDefault();
                      }}
                    />
                  </Autocomplete>
                ) : (
                  <Input placeholder="Loading search..." disabled />
                )}
              </div>
              
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-400">Or Drop a Pin on the Map</label>
                {isLoaded ? (
                  <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-200">
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={mapCenter}
                      zoom={12}
                      onClick={onMapClick}
                    >
                      {!isNaN(parseFloat(formData.lat)) && !isNaN(parseFloat(formData.lng)) && (
                        <Marker position={{ lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) }} />
                      )}
                    </GoogleMap>
                  </div>
                ) : (
                  <div className="h-64 w-full rounded-xl bg-slate-100 flex items-center justify-center text-sm text-slate-400">
                    Loading Map...
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingDepot ? "Save Changes" : "Create Depot"}
                </Button>
              </div>
            </form>
          </DialogBox>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/80 text-xs text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {depots?.map((depot) => (
                <tr key={depot.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{depot.name}</td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {depot.address ? depot.address : <span className="text-slate-400 italic">Location mapped</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(depot)} className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-primary">
                      <Edit style={{ fontSize: 18 }} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(depot.id)} className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-red-500 ml-1">
                      <Delete style={{ fontSize: 18 }} />
                    </Button>
                  </td>
                </tr>
              ))}
              {(!depots || depots.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    No depots found. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center pt-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Scheduling Rules</h2>
            <p className="text-sm text-slate-500 mt-1">Configure automated checks for fatigue and timing constraints.</p>
          </div>
          <Button 
            onClick={handleSaveScheduling} 
            disabled={isUpdatingSettings}
            className="bg-primary hover:bg-primary/90 text-white shadow-md rounded-xl px-6 h-11"
          >
            {isUpdatingSettings ? "Saving..." : "Save Rules"}
          </Button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Driver Working Time</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Maximum Continuous Driving (Hours)</label>
                <Input
                  type="number"
                  step="0.5"
                  value={schedulingForm.maxContinuousDrivingHours}
                  onChange={(e) => setSchedulingForm({ ...schedulingForm, maxContinuousDrivingHours: e.target.value })}
                  className="h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Minimum Break Duration (Minutes)</label>
                <Input
                  type="number"
                  value={schedulingForm.minBreakDurationMinutes}
                  onChange={(e) => setSchedulingForm({ ...schedulingForm, minBreakDurationMinutes: e.target.value })}
                  className="h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Maximum Shift Duration (Hours)</label>
                <Input
                  type="number"
                  step="0.5"
                  value={schedulingForm.maxShiftDurationHours}
                  onChange={(e) => setSchedulingForm({ ...schedulingForm, maxShiftDurationHours: e.target.value })}
                  className="h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Buffers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Buffer Between Jobs (Minutes)</label>
                <Input
                  type="number"
                  value={schedulingForm.bufferMinutes}
                  onChange={(e) => setSchedulingForm({ ...schedulingForm, bufferMinutes: e.target.value })}
                  className="h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Depot Travel Buffer (Minutes)</label>
                <Input
                  type="number"
                  value={schedulingForm.depotTravelBuffer}
                  onChange={(e) => setSchedulingForm({ ...schedulingForm, depotTravelBuffer: e.target.value })}
                  className="h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Auto-Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Transit Time Between Jobs (Minutes)</label>
                <Input
                  type="number"
                  value={schedulingForm.transitTimeMinutes}
                  onChange={(e) => setSchedulingForm({ ...schedulingForm, transitTimeMinutes: e.target.value })}
                  className="h-10 text-sm font-medium border-slate-200 bg-slate-50/50 rounded-xl"
                />
                <p className="text-xs text-slate-400">Minimum gap between the end of one job and the start of the next job during auto-scheduling.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
